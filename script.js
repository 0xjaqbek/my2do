class My2DoApp {
    constructor() {
        this.db = null;
        this.currentView = 'notes';
        this.tasks = [];
        this.categories = [
            { id: 'ogólne', name: 'Ogólne', color: '#2196F3' },
            { id: 'praca', name: 'Praca', color: '#FF9800' },
            { id: 'dom', name: 'Dom', color: '#4CAF50' },
            { id: 'zakupy', name: 'Zakupy', color: '#9C27B0' }
        ];
        this.settings = {
            theme: 'light',
            colorScheme: 'blue',
            fontSize: 16,
            notificationsEnabled: false,
            googleCalendarConnected: false
        };

        this.recognition = null;
        this.isRecording = false;
        this.useLocalStorageFallback = false;

        this.init();
    }

    async init() {
        await this.initDB();
        await this.loadSettings();
        await this.loadCategories();
        await this.loadTasks();

        this.initEventListeners();
        this.initSpeechRecognition();
        this.updateCategorySelect();
        this.renderDashboard();
        this.renderCompletedTasks();
        this.renderSettings();

        // Rejestracja service workera
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }

        // PWA Install prompt
        this.initPWAInstall();

        // Żądanie uprawnień do powiadomień
        if ('Notification' in window) {
            await this.requestNotificationPermission();
        }
    }

    // === BAZA DANYCH ===
    async initDB() {
        // Check if IndexedDB is available
        if (!window.indexedDB) {
            console.warn('IndexedDB not supported, using localStorage fallback');
            this.useLocalStorageFallback = true;
            return;
        }

        return new Promise((resolve, reject) => {
            console.log('Initializing database...');
            this.openDatabase(resolve, reject);
        });
    }

    openDatabase(resolve, reject) {
        const request = indexedDB.open('My2DoDatabase', 1);

        request.onerror = () => {
            console.error('Database error:', request.error);
            console.warn('Attempting to clear corrupted database and retry...');
            this.clearCorruptedDatabase(resolve, reject);
        };

        request.onblocked = () => {
            console.warn('Database blocked, falling back to localStorage');
            this.useLocalStorageFallback = true;
            resolve();
        };

        request.onsuccess = () => {
            this.db = request.result;
            this.useLocalStorageFallback = false;
            console.log('Database opened successfully');

            // Handle version change while app is open
            this.db.onversionchange = () => {
                this.db.close();
                console.log('Database version changed, reloading...');
                window.location.reload();
            };

            resolve();
        };

        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const db = event.target.result;

            try {
                this.setupDatabaseSchema(db);
            } catch (error) {
                console.error('Error creating database schema:', error);
                this.useLocalStorageFallback = true;
            }
        };
    }

    clearCorruptedDatabase(resolve, reject) {
        console.log('Clearing corrupted database...');
        const deleteReq = indexedDB.deleteDatabase('My2DoDatabase');

        deleteReq.onsuccess = () => {
            console.log('Corrupted database cleared, retrying...');
            // Try to open database again after clearing
            const retryRequest = indexedDB.open('My2DoDatabase', 1);

            retryRequest.onsuccess = () => {
                this.db = retryRequest.result;
                this.useLocalStorageFallback = false;
                console.log('Database reopened successfully after clearing');
                resolve();
            };

            retryRequest.onerror = () => {
                console.error('Still cannot open database after clearing, using localStorage');
                this.useLocalStorageFallback = true;
                resolve();
            };

            retryRequest.onupgradeneeded = (event) => {
                this.setupDatabaseSchema(event.target.result);
            };
        };

        deleteReq.onerror = () => {
            console.error('Cannot clear database, falling back to localStorage');
            this.useLocalStorageFallback = true;
            resolve();
        };
    }

    setupDatabaseSchema(db) {
        try {
            if (!db.objectStoreNames.contains('tasks')) {
                console.log('Creating tasks store');
                const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                taskStore.createIndex('completed', 'completed', { unique: false });
                taskStore.createIndex('dueDate', 'dueDate', { unique: false });
                taskStore.createIndex('priority', 'priority', { unique: false });
                taskStore.createIndex('category', 'category', { unique: false });
            }

            if (!db.objectStoreNames.contains('categories')) {
                console.log('Creating categories store');
                db.createObjectStore('categories', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('settings')) {
                console.log('Creating settings store');
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        } catch (error) {
            console.error('Error creating database schema:', error);
            throw error;
        }
    }

    async saveToStore(storeName, data) {
        if (this.useLocalStorageFallback) {
            return this.saveToLocalStorage(storeName, data);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction([storeName], 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('IndexedDB error, falling back to localStorage:', error);
                this.useLocalStorageFallback = true;
                resolve(this.saveToLocalStorage(storeName, data));
            }
        });
    }

    saveToLocalStorage(storeName, data) {
        try {
            const key = `${storeName}_${data.id || data.key}`;
            localStorage.setItem(key, JSON.stringify(data));

            // Also maintain a list of items for each store
            const listKey = `${storeName}_list`;
            const existingList = JSON.parse(localStorage.getItem(listKey) || '[]');
            const itemId = data.id || data.key;

            if (!existingList.includes(itemId)) {
                existingList.push(itemId);
                localStorage.setItem(listKey, JSON.stringify(existingList));
            }

            return data;
        } catch (error) {
            console.error('localStorage error:', error);
            throw error;
        }
    }

    async getFromStore(storeName, key = null) {
        if (this.useLocalStorageFallback) {
            return this.getFromLocalStorage(storeName, key);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction([storeName], 'readonly');
                const store = tx.objectStore(storeName);

                let request;
                if (key) {
                    request = store.get(key);
                } else {
                    request = store.getAll();
                }

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('IndexedDB error, falling back to localStorage:', error);
                this.useLocalStorageFallback = true;
                resolve(this.getFromLocalStorage(storeName, key));
            }
        });
    }

    getFromLocalStorage(storeName, key = null) {
        try {
            if (key) {
                const item = localStorage.getItem(`${storeName}_${key}`);
                return item ? JSON.parse(item) : null;
            } else {
                const listKey = `${storeName}_list`;
                const itemIds = JSON.parse(localStorage.getItem(listKey) || '[]');
                const items = [];

                for (const itemId of itemIds) {
                    const item = localStorage.getItem(`${storeName}_${itemId}`);
                    if (item) {
                        items.push(JSON.parse(item));
                    }
                }

                return items;
            }
        } catch (error) {
            console.error('localStorage error:', error);
            return key ? null : [];
        }
    }

    async deleteFromStore(storeName, key) {
        if (this.useLocalStorageFallback) {
            return this.deleteFromLocalStorage(storeName, key);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction([storeName], 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('IndexedDB error, falling back to localStorage:', error);
                this.useLocalStorageFallback = true;
                resolve(this.deleteFromLocalStorage(storeName, key));
            }
        });
    }

    deleteFromLocalStorage(storeName, key) {
        try {
            localStorage.removeItem(`${storeName}_${key}`);

            // Remove from list
            const listKey = `${storeName}_list`;
            const existingList = JSON.parse(localStorage.getItem(listKey) || '[]');
            const updatedList = existingList.filter(id => id !== key);
            localStorage.setItem(listKey, JSON.stringify(updatedList));

            return true;
        } catch (error) {
            console.error('localStorage error:', error);
            throw error;
        }
    }

    // === ZADANIA ===
    async loadTasks() {
        try {
            console.log('Loading tasks from storage...');
            const loadedTasks = await this.getFromStore('tasks');
            this.tasks = loadedTasks || [];
            console.log('Loaded tasks:', this.tasks.length, 'tasks');
        } catch (error) {
            console.error('Błąd ładowania zadań:', error);
            this.tasks = [];
        }
    }

    async saveTask(taskData) {
        console.log('Saving task:', taskData);

        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description || '',
            dueDate: taskData.dueDate,
            dueTime: taskData.dueTime,
            priority: taskData.priority,
            category: taskData.category,
            reminderOffset: taskData.reminderOffset,
            recurring: taskData.recurring,
            recurringType: taskData.recurringType,
            subtasks: taskData.subtasks || [],
            completed: false,
            reminderSent: false,
            createdAt: new Date().toISOString()
        };

        if (task.dueDate && task.dueTime && task.reminderOffset > 0) {
            const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
            task.reminder = new Date(dueDateTime.getTime() - (task.reminderOffset * 60000)).toISOString();
        }

        console.log('Created task object:', task);

        try {
            await this.saveToStore('tasks', task);
            console.log('Task saved to database');

            this.tasks.push(task);
            console.log('Task added to array, total tasks:', this.tasks.length);

            this.renderDashboard();
            console.log('Dashboard rendered');

            this.scheduleNotification(task);
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Błąd zapisywania zadania: ' + error.message);
        }

        return task;
    }

    async updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
        await this.saveToStore('tasks', this.tasks[taskIndex]);

        this.renderDashboard();
        this.renderCompletedTasks();
    }

    async deleteTask(taskId) {
        await this.deleteFromStore('tasks', taskId);
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.renderDashboard();
        this.renderCompletedTasks();
    }

    async completeTask(taskId) {
        await this.updateTask(taskId, {
            completed: true,
            completedAt: new Date().toISOString()
        });

        // Jeśli zadanie jest cykliczne, stwórz następne
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.recurring && task.recurringType) {
            await this.createRecurringTask(task);
        }
    }

    async createRecurringTask(originalTask) {
        const nextDueDate = this.getNextRecurringDate(originalTask.dueDate, originalTask.recurringType);

        const newTask = {
            ...originalTask,
            id: Date.now().toString(),
            dueDate: nextDueDate.toISOString().split('T')[0],
            completed: false,
            reminderSent: false,
            createdAt: new Date().toISOString()
        };

        if (newTask.dueDate && newTask.dueTime && newTask.reminderOffset > 0) {
            const dueDateTime = new Date(`${newTask.dueDate}T${newTask.dueTime}`);
            newTask.reminder = new Date(dueDateTime.getTime() - (newTask.reminderOffset * 60000)).toISOString();
        }

        await this.saveToStore('tasks', newTask);
        this.tasks.push(newTask);
        this.renderDashboard();
        this.scheduleNotification(newTask);
    }

    getNextRecurringDate(dateString, type) {
        const date = new Date(dateString);

        switch (type) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
        }

        return date;
    }

    // === KATEGORIE ===
    async loadCategories() {
        try {
            const savedCategories = await this.getFromStore('categories');
            if (savedCategories && savedCategories.length > 0) {
                this.categories = savedCategories;
            } else {
                // Zapisz domyślne kategorie
                for (const category of this.categories) {
                    await this.saveToStore('categories', category);
                }
            }
        } catch (error) {
            console.error('Błąd ładowania kategorii:', error);
        }
    }

    async addCategory(name, color) {
        const category = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            color
        };

        await this.saveToStore('categories', category);
        this.categories.push(category);
        this.updateCategorySelect();
        this.renderSettings();
    }

    async deleteCategory(categoryId) {
        await this.deleteFromStore('categories', categoryId);
        this.categories = this.categories.filter(c => c.id !== categoryId);
        this.updateCategorySelect();
        this.renderSettings();
    }

    // === USTAWIENIA ===
    async loadSettings() {
        try {
            const savedSettings = await this.getFromStore('settings');
            for (const setting of savedSettings) {
                this.settings[setting.key] = setting.value;
            }
        } catch (error) {
            console.error('Błąd ładowania ustawień:', error);
        }

        this.applySettings();
    }

    async saveSetting(key, value) {
        this.settings[key] = value;
        await this.saveToStore('settings', { key, value });
        this.applySettings();
    }

    applySettings() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        document.documentElement.setAttribute('data-color-scheme', this.settings.colorScheme);
        document.documentElement.style.setProperty('--font-size', `${this.settings.fontSize}px`);
    }

    // === POWIADOMIENIA ===
    async requestNotificationPermission() {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            await this.saveSetting('notificationsEnabled', permission === 'granted');
        } else {
            await this.saveSetting('notificationsEnabled', Notification.permission === 'granted');
        }
    }

    scheduleNotification(task) {
        if (!this.settings.notificationsEnabled || !task.reminder) return;

        const reminderTime = new Date(task.reminder);
        const now = new Date();

        if (reminderTime > now) {
            const delay = reminderTime.getTime() - now.getTime();

            setTimeout(() => {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: `Przypomnienie: ${task.title}`,
                        body: task.description || 'Czas na wykonanie zadania',
                        taskId: task.id
                    });
                } else {
                    new Notification(`Przypomnienie: ${task.title}`, {
                        body: task.description || 'Czas na wykonanie zadania',
                        icon: '/icons/icon-192x192.png'
                    });
                }
            }, delay);
        }
    }

    // === PWA INSTALL ===
    initPWAInstall() {
        let deferredPrompt;

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            deferredPrompt = e;

            // Show install button or notification
            this.showInstallPrompt();
        });

        // Listen for app installed
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            deferredPrompt = null;
        });

        // Check if already installed
        window.addEventListener('DOMContentLoaded', () => {
            if (window.matchMedia('(display-mode: standalone)').matches) {
                console.log('PWA is running in standalone mode');
            }
        });
    }

    showInstallPrompt() {
        // You can add a custom install button here
        console.log('PWA can be installed');

        // For debugging - show alert
        if (window.location.hostname !== 'localhost') {
            setTimeout(() => {
                if (confirm('Czy chcesz zainstalować My2Do jako aplikację?')) {
                    this.installPWA();
                }
            }, 3000);
        }
    }

    async installPWA() {
        const deferredPrompt = window.deferredPrompt;
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        console.log(`User response to the install prompt: ${outcome}`);
        window.deferredPrompt = null;
    }

    // === ROZPOZNAWANIE MOWY ===
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();

            this.recognition.lang = 'pl-PL';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onstart = () => {
                this.isRecording = true;
                document.getElementById('voice-btn').classList.add('recording');
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                this.processVoiceCommand(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Błąd rozpoznawania mowy:', event.error);
                this.isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
            };
        }
    }

    processVoiceCommand(transcript) {
        const taskInput = document.getElementById('task-input');

        // Podstawowe komendy
        if (transcript.includes('nowe zadanie') || transcript.includes('dodaj zadanie')) {
            taskInput.value = '';
            taskInput.focus();
            return;
        }

        // Ustawianie priorytetu
        if (transcript.includes('priorytet wysoki') || transcript.includes('wysoki priorytet')) {
            document.getElementById('task-priority').value = 'wysoki';
        } else if (transcript.includes('priorytet średni') || transcript.includes('średni priorytet')) {
            document.getElementById('task-priority').value = 'średni';
        } else if (transcript.includes('priorytet niski') || transcript.includes('niski priorytet')) {
            document.getElementById('task-priority').value = 'niski';
        }

        // Ustawianie kategorii
        for (const category of this.categories) {
            if (transcript.includes(category.name.toLowerCase())) {
                document.getElementById('task-category').value = category.id;
                break;
            }
        }

        // Ustawianie czasu przypomnienia
        if (transcript.includes('przypomnij za 5 minut') || transcript.includes('5 minut wcześniej')) {
            document.getElementById('reminder-time').value = '5';
        } else if (transcript.includes('przypomnij za 15 minut') || transcript.includes('15 minut wcześniej')) {
            document.getElementById('reminder-time').value = '15';
        } else if (transcript.includes('przypomnij za godzinę') || transcript.includes('godzinę wcześniej')) {
            document.getElementById('reminder-time').value = '60';
        }

        // Zadania cykliczne
        if (transcript.includes('codziennie') || transcript.includes('każdego dnia')) {
            document.getElementById('recurring-task').checked = true;
            document.getElementById('recurring-type').disabled = false;
            document.getElementById('recurring-type').value = 'daily';
        } else if (transcript.includes('co tydzień') || transcript.includes('tygodniowo')) {
            document.getElementById('recurring-task').checked = true;
            document.getElementById('recurring-type').disabled = false;
            document.getElementById('recurring-type').value = 'weekly';
        }

        // Dodawanie treści zadania
        if (!taskInput.value) {
            taskInput.value = transcript;
        } else {
            taskInput.value += ' ' + transcript;
        }
    }

    // === INTERFEJS UŻYTKOWNIKA ===
    initEventListeners() {
        // Nawigacja
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.closest('.nav-btn').dataset.view);
            });
        });

        // Przycisk głosowy
        document.getElementById('voice-btn').addEventListener('click', () => {
            this.toggleVoiceRecording();
        });

        // Formularz zadania
        document.getElementById('save-task').addEventListener('click', () => {
            this.handleSaveTask();
        });

        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearTaskForm();
        });

        // Podzadania
        document.getElementById('add-subtask').addEventListener('click', () => {
            this.addSubtaskInput();
        });

        // Zadania cykliczne
        document.getElementById('recurring-task').addEventListener('change', (e) => {
            document.getElementById('recurring-type').disabled = !e.target.checked;
        });

        // Ustawienia
        document.getElementById('theme-select').addEventListener('change', (e) => {
            this.saveSetting('theme', e.target.value);
        });

        document.getElementById('color-scheme').addEventListener('change', (e) => {
            this.saveSetting('colorScheme', e.target.value);
        });

        document.getElementById('font-size').addEventListener('input', (e) => {
            this.saveSetting('fontSize', parseInt(e.target.value));
            document.getElementById('font-size-value').textContent = e.target.value + 'px';
        });

        document.getElementById('enable-notifications').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.requestNotificationPermission();
            } else {
                this.saveSetting('notificationsEnabled', false);
            }
        });

        // Kategorie
        document.getElementById('add-category').addEventListener('click', () => {
            document.getElementById('category-modal').classList.add('show');
        });

        document.getElementById('save-category').addEventListener('click', () => {
            this.handleSaveCategory();
        });

        // Modals
        document.querySelectorAll('.close, .cancel-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('show');
                });
            });
        });

        // Ukończone zadania
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.clearCompletedTasks();
        });

        // Kalendarz Google
        document.getElementById('connect-calendar').addEventListener('click', () => {
            this.handleGoogleCalendar();
        });
    }


    switchView(viewName) {
        // Aktualizuj nawigację
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Przełącz widoki
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;
    }

    toggleVoiceRecording() {
        if (!this.recognition) {
            alert('Rozpoznawanie mowy nie jest dostępne w tej przeglądarce');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    async handleSaveTask() {
        const title = document.getElementById('task-input').value.trim();
        if (!title) {
            alert('Wprowadź tytuł zadania');
            return;
        }

        const subtaskInputs = document.querySelectorAll('#subtasks-container input');
        const subtasks = Array.from(subtaskInputs)
            .map(input => input.value.trim())
            .filter(text => text.length > 0)
            .map(text => ({ id: Date.now() + Math.random(), text, completed: false }));

        const taskData = {
            title,
            description: '',
            dueDate: document.getElementById('task-date').value,
            dueTime: document.getElementById('task-time').value,
            priority: document.getElementById('task-priority').value,
            category: document.getElementById('task-category').value,
            reminderOffset: parseInt(document.getElementById('reminder-time').value),
            recurring: document.getElementById('recurring-task').checked,
            recurringType: document.getElementById('recurring-type').value,
            subtasks
        };

        await this.saveTask(taskData);
        this.clearTaskForm();
        alert('Zadanie zostało zapisane!');
    }

    clearTaskForm() {
        document.getElementById('task-input').value = '';
        document.getElementById('task-date').value = '';
        document.getElementById('task-time').value = '';
        document.getElementById('task-priority').value = 'niski';
        document.getElementById('task-category').value = 'ogólne';
        document.getElementById('reminder-time').value = '0';
        document.getElementById('recurring-task').checked = false;
        document.getElementById('recurring-type').disabled = true;
        document.getElementById('subtasks-container').innerHTML = '';
    }

    addSubtaskInput() {
        const container = document.getElementById('subtasks-container');
        const subtaskDiv = document.createElement('div');
        subtaskDiv.className = 'subtask-item';
        subtaskDiv.innerHTML = `
            <input type="text" placeholder="Podzadanie..." />
            <button type="button" class="subtask-remove">×</button>
        `;

        subtaskDiv.querySelector('.subtask-remove').addEventListener('click', () => {
            subtaskDiv.remove();
        });

        container.appendChild(subtaskDiv);
    }

    updateCategorySelect() {
        const select = document.getElementById('task-category');
        select.innerHTML = '';

        for (const category of this.categories) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        }
    }

    handleSaveCategory() {
        const name = document.getElementById('new-category-name').value.trim();
        const color = document.getElementById('new-category-color').value;

        if (!name) {
            alert('Wprowadź nazwę kategorii');
            return;
        }

        this.addCategory(name, color);
        document.getElementById('category-modal').classList.remove('show');
        document.getElementById('new-category-name').value = '';
        document.getElementById('new-category-color').value = '#2196F3';
    }

    renderDashboard() {
        console.log('Rendering dashboard, total tasks:', this.tasks.length);

        const activeTasks = this.tasks.filter(t => !t.completed);
        console.log('Active tasks:', activeTasks.length);

        const generalTasks = activeTasks.filter(t => !t.dueDate || !t.dueTime);
        const timelineTasks = activeTasks.filter(t => t.dueDate && t.dueTime)
            .sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`));

        console.log('General tasks:', generalTasks.length);
        console.log('Timeline tasks:', timelineTasks.length);

        this.renderTaskList('general-tasks', generalTasks);
        this.renderTaskList('timeline-tasks', timelineTasks);
    }

    renderTaskList(containerId, tasks) {
        console.log(`Rendering task list for ${containerId}, ${tasks.length} tasks`);

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found!`);
            return;
        }

        container.innerHTML = '';

        for (const task of tasks) {
            console.log(`Rendering task: ${task.title}`);
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        }

        console.log(`Finished rendering ${containerId}`);
    }

    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = 'task-item';
        if (task.completed) div.classList.add('completed');

        const category = this.categories.find(c => c.id === task.category);
        const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pl-PL') : '';
        const dueTimeText = task.dueTime || '';

        div.innerHTML = `
            <div class="task-priority ${task.priority}"></div>
            <div class="task-title">${task.title}</div>
            ${task.subtasks.length > 0 ? `<div class="task-meta">Podzadania: ${task.subtasks.length}</div>` : ''}
            <div class="task-meta">
                <span class="task-category" style="background-color: ${category.color}20; color: ${category.color}">
                    ${category.name}
                </span>
                ${dueDateText ? `<span>${dueDateText} ${dueTimeText}</span>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            this.showTaskDetails(task);
        });

        return div;
    }

    showTaskDetails(task) {
        const modal = document.getElementById('task-modal');
        const details = document.getElementById('task-details');

        const category = this.categories.find(c => c.id === task.category);
        const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pl-PL') : 'Brak';
        const dueTimeText = task.dueTime || 'Brak';

        details.innerHTML = `
            <h3>${task.title}</h3>
            <p><strong>Kategoria:</strong> ${category.name}</p>
            <p><strong>Priorytet:</strong> ${task.priority}</p>
            <p><strong>Data:</strong> ${dueDateText}</p>
            <p><strong>Czas:</strong> ${dueTimeText}</p>
            ${task.description ? `<p><strong>Opis:</strong> ${task.description}</p>` : ''}
            ${task.subtasks.length > 0 ? `
                <div>
                    <strong>Podzadania:</strong>
                    <ul>
                        ${task.subtasks.map(st => `<li>${st.completed ? '✓' : '○'} ${st.text}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            <div class="modal-actions">
                ${!task.completed ? `<button onclick="app.completeTask('${task.id}')" class="btn-primary">Oznacz jako wykonane</button>` : ''}
                ${task.dueDate && task.dueTime && !task.completed ? `<button onclick="app.exportTaskToGoogleCalendar(app.tasks.find(t => t.id === '${task.id}'))" class="btn-secondary">Eksportuj do kalendarza</button>` : ''}
                <button onclick="app.deleteTask('${task.id}')" class="btn-secondary">Usuń</button>
            </div>
        `;

        modal.classList.add('show');
    }

    renderCompletedTasks() {
        const completedTasks = this.tasks.filter(t => t.completed)
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        this.renderTaskList('completed-tasks', completedTasks);
    }

    async clearCompletedTasks() {
        if (confirm('Czy na pewno chcesz usunąć wszystkie ukończone zadania?')) {
            const completedTasks = this.tasks.filter(t => t.completed);

            for (const task of completedTasks) {
                await this.deleteFromStore('tasks', task.id);
            }

            this.tasks = this.tasks.filter(t => !t.completed);
            this.renderCompletedTasks();
        }
    }

    renderSettings() {
        // Aktualizuj wartości w formularzu
        document.getElementById('theme-select').value = this.settings.theme;
        document.getElementById('color-scheme').value = this.settings.colorScheme;
        document.getElementById('font-size').value = this.settings.fontSize;
        document.getElementById('font-size-value').textContent = this.settings.fontSize + 'px';
        document.getElementById('enable-notifications').checked = this.settings.notificationsEnabled;

        // Renderuj kategorie
        const categoriesList = document.getElementById('categories-list');
        categoriesList.innerHTML = '';

        for (const category of this.categories) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item';
            categoryDiv.innerHTML = `
                <div class="category-color" style="background-color: ${category.color}"></div>
                <div class="category-name">${category.name}</div>
                ${this.categories.length > 1 ? `<button onclick="app.deleteCategory('${category.id}')" class="category-delete">Usuń</button>` : ''}
            `;
            categoriesList.appendChild(categoryDiv);
        }

        // Status kalendarza Google
        this.updateGoogleCalendarStatus();
    }

    // === INTEGRACJA Z KALENDARZEM GOOGLE ===
    async handleGoogleCalendar() {
        if (!window.gapi) {
            // Ładuj Google API
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                this.initGoogleAPI();
            };
            document.head.appendChild(script);
        } else {
            this.initGoogleAPI();
        }
    }

    async initGoogleAPI() {
        // Uwaga: Wymagany jest klucz API i Client ID z Google Cloud Console
        const API_KEY = 'YOUR_API_KEY_HERE';
        const CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';

        await new Promise((resolve) => {
            gapi.load('client:auth2', resolve);
        });

        await gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scope: 'https://www.googleapis.com/auth/calendar.events'
        });

        const authInstance = gapi.auth2.getAuthInstance();

        if (!authInstance.isSignedIn.get()) {
            try {
                await authInstance.signIn();
                this.saveSetting('googleCalendarConnected', true);
                this.updateGoogleCalendarStatus();
            } catch (error) {
                console.error('Błąd autoryzacji Google:', error);
                alert('Nie udało się połączyć z kalendarzem Google');
            }
        } else {
            this.saveSetting('googleCalendarConnected', true);
            this.updateGoogleCalendarStatus();
        }
    }

    async exportTaskToGoogleCalendar(task) {
        if (!this.settings.googleCalendarConnected || !window.gapi) {
            alert('Kalendarz Google nie jest podłączony');
            return;
        }

        const event = {
            summary: task.title,
            description: task.description || '',
            start: {
                dateTime: `${task.dueDate}T${task.dueTime || '12:00'}:00`,
                timeZone: 'Europe/Warsaw'
            },
            end: {
                dateTime: `${task.dueDate}T${task.dueTime ? this.addHourToTime(task.dueTime) : '13:00'}:00`,
                timeZone: 'Europe/Warsaw'
            },
            reminders: {
                useDefault: false,
                overrides: task.reminderOffset > 0 ? [
                    { method: 'popup', minutes: task.reminderOffset }
                ] : []
            }
        };

        try {
            const response = await gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: event
            });

            console.log('Zadanie wyeksportowane do kalendarza:', response);
            alert('Zadanie zostało dodane do kalendarza Google!');
        } catch (error) {
            console.error('Błąd eksportu do kalendarza:', error);
            alert('Nie udało się dodać zadania do kalendarza');
        }
    }

    addHourToTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        const newHours = (parseInt(hours) + 1).toString().padStart(2, '0');
        return `${newHours}:${minutes}`;
    }

    updateGoogleCalendarStatus() {
        const statusElement = document.getElementById('calendar-status');

        if (this.settings.googleCalendarConnected) {
            statusElement.innerHTML = `
                <div class="notification-status granted">
                    ✓ Połączono z kalendarzem Google
                </div>
                <button onclick="app.exportAllTasksToCalendar()" class="btn-secondary" style="margin-top: 10px;">
                    Eksportuj wszystkie zadania
                </button>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="notification-status default">
                    Kalendarz Google nie jest podłączony
                </div>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                    Uwaga: Wymaga konfiguracji klucza API
                </p>
            `;
        }
    }

    async exportAllTasksToCalendar() {
        if (!confirm('Czy chcesz wyeksportować wszystkie aktywne zadania z datą do kalendarza Google?')) {
            return;
        }

        const tasksToExport = this.tasks.filter(t => !t.completed && t.dueDate);
        let exported = 0;

        for (const task of tasksToExport) {
            try {
                await this.exportTaskToGoogleCalendar(task);
                exported++;
                // Krótka przerwa między requestami
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Błąd eksportu zadania:', task.title, error);
            }
        }

        alert(`Wyeksportowano ${exported} z ${tasksToExport.length} zadań`);
    }
}

// Inicjalizacja aplikacji
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new My2DoApp();
});

// Obsługa kliknięcia w powiadomienie
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'NOTIFICATION_CLICK') {
            // Przełącz na widok pulpitu
            if (app) {
                app.switchView('dashboard');
            }
        }
    });
}