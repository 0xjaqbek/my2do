class My2DoSimple {
    constructor() {
        this.data = {
            todo: [],
            done: [],
            settings: {
                theme: 'light',
                colorScheme: 'blue',
                fontSize: 16,
                notificationsEnabled: false
            },
            categories: [
                { id: 'ogólne', name: 'Ogólne', color: '#2196F3' },
                { id: 'praca', name: 'Praca', color: '#FF9800' },
                { id: 'dom', name: 'Dom', color: '#4CAF50' },
                { id: 'zakupy', name: 'Zakupy', color: '#9C27B0' }
            ]
        };

        this.storageKey = 'my2do-data-v1';
        this.recognition = null;
        this.isRecording = false;
        this.currentView = 'notes';

        this.init();
    }

    // === STORAGE ===
    saveData() {
        try {
            const dataString = JSON.stringify(this.data, null, 2);
            localStorage.setItem(this.storageKey, dataString);
            console.log('💾 Data saved successfully');

            // Auto-backup to downloadable file every 10 saves
            const saveCount = parseInt(localStorage.getItem('saveCount') || '0') + 1;
            localStorage.setItem('saveCount', saveCount.toString());

            if (saveCount % 10 === 0) {
                this.downloadBackup();
            }

            return true;
        } catch (error) {
            console.error('❌ Error saving data:', error);
            return false;
        }
    }

    loadData() {
        try {
            // First try to load new format
            const dataString = localStorage.getItem(this.storageKey);
            if (dataString) {
                const loadedData = JSON.parse(dataString);

                // Merge loaded data with defaults to handle new properties
                this.data = {
                    ...this.data,
                    ...loadedData,
                    settings: { ...this.data.settings, ...loadedData.settings },
                    categories: loadedData.categories || this.data.categories
                };

                console.log('📖 New format data loaded successfully:', {
                    todo: this.data.todo.length,
                    done: this.data.done.length
                });
                return true;
            }

            // If no new format, try to migrate from old format
            console.log('🔄 Attempting to migrate old data...');
            if (this.migrateOldData()) {
                console.log('✅ Old data migrated successfully');
                return true;
            }

        } catch (error) {
            console.error('❌ Error loading data:', error);
        }
        return false;
    }

    migrateOldData() {
        try {
            // Check for old localStorage format (my2do_tasks_list, etc.)
            const oldTasksList = localStorage.getItem('my2do_tasks_list');
            if (oldTasksList) {
                const taskIds = JSON.parse(oldTasksList);
                const migratedTasks = [];

                for (const taskId of taskIds) {
                    const taskData = localStorage.getItem(`my2do_tasks_${taskId}`);
                    if (taskData) {
                        const task = JSON.parse(taskData);
                        if (task.completed) {
                            this.data.done.push(task);
                        } else {
                            this.data.todo.push(task);
                        }
                        migratedTasks.push(task);
                    }
                }

                console.log(`🔄 Migrated ${migratedTasks.length} tasks from old format`);

                // Save in new format
                this.saveData();

                // Clean up old format (optional - commented out for safety)
                // this.cleanupOldData();

                return migratedTasks.length > 0;
            }

            // Check for even older IndexedDB fallback data
            return this.checkForOldIndexedDBData();

        } catch (error) {
            console.error('❌ Error migrating old data:', error);
            return false;
        }
    }

    checkForOldIndexedDBData() {
        // This would require more complex migration, for now just return false
        // In the future, we could add migration from other storage formats
        return false;
    }

    cleanupOldData() {
        // Clean up old localStorage entries (call this manually if needed)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('my2do_')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed old key: ${key}`);
        });

        console.log(`🧹 Cleaned up ${keysToRemove.length} old storage keys`);
    }

    downloadBackup() {
        const dataString = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `my2do-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        console.log('💾 Backup file downloaded');
    }

    importBackup(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.data = importedData;
                this.saveData();
                this.renderAll();
                alert('✅ Dane zostały zaimportowane!');
            } catch (error) {
                console.error('❌ Error importing data:', error);
                alert('❌ Błąd importu pliku');
            }
        };
        reader.readAsText(file);
    }

    // === INITIALIZATION ===
    async init() {
        console.log('🚀 Initializing My2Do Simple...');

        // Load data first
        this.loadData();

        // Initialize UI
        this.initEventListeners();
        this.initSpeechRecognition();
        this.renderAll();
        this.applySettings();

        // Service worker
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
                console.log('✅ Service worker registered');
            } catch (error) {
                console.log('❌ Service worker failed:', error);
            }
        }

        // Notifications
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        console.log('✅ My2Do Simple initialized');
    }

    // === TASKS ===
    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description || '',
            dueDate: taskData.dueDate || '',
            dueTime: taskData.dueTime || '',
            priority: taskData.priority || 'niski',
            category: taskData.category || 'ogólne',
            reminderOffset: taskData.reminderOffset || 0,
            recurring: taskData.recurring || false,
            recurringType: taskData.recurringType || '',
            subtasks: taskData.subtasks || [],
            createdAt: new Date().toISOString()
        };

        // Set reminder time if needed
        if (task.dueDate && task.dueTime && task.reminderOffset > 0) {
            const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
            task.reminderTime = new Date(dueDateTime.getTime() - (task.reminderOffset * 60000)).toISOString();
        }

        this.data.todo.push(task);
        this.saveData();
        this.renderDashboard();

        console.log('✅ Task added:', task.title);
        return task;
    }

    completeTask(taskId) {
        const taskIndex = this.data.todo.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = this.data.todo[taskIndex];
        task.completedAt = new Date().toISOString();

        // Move from todo to done
        this.data.todo.splice(taskIndex, 1);
        this.data.done.push(task);

        this.saveData();
        this.renderDashboard();
        this.renderCompleted();

        console.log('✅ Task completed:', task.title);
    }

    deleteTask(taskId, fromDone = false) {
        const list = fromDone ? this.data.done : this.data.todo;
        const taskIndex = list.findIndex(t => t.id === taskId);

        if (taskIndex !== -1) {
            const task = list.splice(taskIndex, 1)[0];
            this.saveData();
            this.renderDashboard();
            this.renderCompleted();
            console.log('🗑️ Task deleted:', task.title);
        }
    }

    clearCompletedTasks() {
        if (confirm('Czy na pewno chcesz usunąć wszystkie ukończone zadania?')) {
            this.data.done = [];
            this.saveData();
            this.renderCompleted();
            console.log('🗑️ All completed tasks cleared');
        }
    }

    // === RENDERING ===
    renderAll() {
        this.renderDashboard();
        this.renderCompleted();
        this.renderSettings();
    }

    renderDashboard() {
        const generalTasks = this.data.todo.filter(t => !t.dueDate || !t.dueTime);
        const timelineTasks = this.data.todo.filter(t => t.dueDate && t.dueTime)
            .sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`));

        this.renderTaskList('general-tasks', generalTasks);
        this.renderTaskList('timeline-tasks', timelineTasks);
    }

    renderCompleted() {
        const completedTasks = this.data.done.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        this.renderTaskList('completed-tasks', completedTasks, true);
    }

    renderTaskList(containerId, tasks, isCompleted = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task, isCompleted);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task, isCompleted = false) {
        const div = document.createElement('div');
        div.className = 'task-item';
        if (isCompleted) div.classList.add('completed');

        const category = this.data.categories.find(c => c.id === task.category) || this.data.categories[0];
        const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pl-PL') : '';

        div.innerHTML = `
            <div class="task-priority ${task.priority}"></div>
            <div class="task-title">${task.title}</div>
            ${task.subtasks && task.subtasks.length > 0 ? `<div class="task-meta">Podzadania: ${task.subtasks.length}</div>` : ''}
            <div class="task-meta">
                <span class="task-category" style="background-color: ${category.color}20; color: ${category.color}">
                    ${category.name}
                </span>
                ${dueDateText ? `<span>${dueDateText} ${task.dueTime || ''}</span>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            this.showTaskDetails(task, isCompleted);
        });

        return div;
    }

    showTaskDetails(task, isCompleted) {
        const modal = document.getElementById('task-modal');
        const details = document.getElementById('task-details');
        const category = this.data.categories.find(c => c.id === task.category) || this.data.categories[0];

        details.innerHTML = `
            <h3>${task.title}</h3>
            <p><strong>Kategoria:</strong> ${category.name}</p>
            <p><strong>Priorytet:</strong> ${task.priority}</p>
            <p><strong>Data:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('pl-PL') : 'Brak'}</p>
            <p><strong>Czas:</strong> ${task.dueTime || 'Brak'}</p>
            ${task.description ? `<p><strong>Opis:</strong> ${task.description}</p>` : ''}
            ${task.subtasks && task.subtasks.length > 0 ? `
                <div><strong>Podzadania:</strong>
                <ul>${task.subtasks.map(st => `<li>${st.completed ? '✓' : '○'} ${st.text}</li>`).join('')}</ul>
                </div>
            ` : ''}
            <div class="modal-actions">
                ${!isCompleted ? `<button onclick="app.completeTask('${task.id}')" class="btn-primary">Oznacz jako wykonane</button>` : ''}
                <button onclick="app.deleteTask('${task.id}', ${isCompleted})" class="btn-secondary">Usuń</button>
            </div>
        `;

        modal.classList.add('show');
    }

    renderSettings() {
        document.getElementById('theme-select').value = this.data.settings.theme;
        document.getElementById('color-scheme').value = this.data.settings.colorScheme;
        document.getElementById('font-size').value = this.data.settings.fontSize;
        document.getElementById('font-size-value').textContent = this.data.settings.fontSize + 'px';
        document.getElementById('enable-notifications').checked = this.data.settings.notificationsEnabled;

        // Render categories
        const categoriesList = document.getElementById('categories-list');
        categoriesList.innerHTML = '';

        this.data.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item';
            categoryDiv.innerHTML = `
                <div class="category-color" style="background-color: ${category.color}"></div>
                <div class="category-name">${category.name}</div>
                ${this.data.categories.length > 1 ? `<button onclick="app.deleteCategory('${category.id}')" class="category-delete">Usuń</button>` : ''}
            `;
            categoriesList.appendChild(categoryDiv);
        });

        this.updateCategorySelect();
    }

    updateCategorySelect() {
        const select = document.getElementById('task-category');
        select.innerHTML = '';

        this.data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    // === SETTINGS ===
    saveSetting(key, value) {
        this.data.settings[key] = value;
        this.saveData();
        this.applySettings();
    }

    applySettings() {
        document.documentElement.setAttribute('data-theme', this.data.settings.theme);
        document.documentElement.setAttribute('data-color-scheme', this.data.settings.colorScheme);
        document.documentElement.style.setProperty('--font-size', `${this.data.settings.fontSize}px`);
    }

    // === EVENT HANDLERS ===
    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.closest('.nav-btn').dataset.view);
            });
        });

        // Task form
        document.getElementById('save-task').addEventListener('click', () => {
            this.handleSaveTask();
        });

        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearTaskForm();
        });

        // Voice
        document.getElementById('voice-btn').addEventListener('click', () => {
            this.toggleVoiceRecording();
        });

        // Subtasks
        document.getElementById('add-subtask').addEventListener('click', () => {
            this.addSubtaskInput();
        });

        document.getElementById('recurring-task').addEventListener('change', (e) => {
            document.getElementById('recurring-type').disabled = !e.target.checked;
        });

        // Settings
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
            this.saveSetting('notificationsEnabled', e.target.checked);
        });

        // Categories
        document.getElementById('add-category').addEventListener('click', () => {
            document.getElementById('category-modal').classList.add('show');
        });

        document.getElementById('save-category').addEventListener('click', () => {
            this.handleSaveCategory();
        });

        // Completed tasks
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.clearCompletedTasks();
        });

        // Modals
        document.querySelectorAll('.close, .cancel-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('show');
                });
            });
        });

        // Backup
        this.addBackupHandlers();
    }

    addBackupHandlers() {
        // Add backup button to settings if not exists
        const settingsContainer = document.querySelector('.settings-container');
        if (settingsContainer && !document.getElementById('backup-section')) {
            const backupSection = document.createElement('div');
            backupSection.id = 'backup-section';
            backupSection.className = 'settings-section';
            backupSection.innerHTML = `
                <h3>Backup danych</h3>
                <button id="download-backup" class="btn-primary">Pobierz kopię zapasową</button>
                <input type="file" id="import-backup" accept=".json" style="display: none;">
                <button id="import-backup-btn" class="btn-secondary">Importuj kopię zapasową</button>
                <button id="migrate-old-data" class="btn-secondary">Migruj stare dane</button>
                <button id="cleanup-old-data" class="btn-secondary">Wyczyść stare dane</button>
            `;
            settingsContainer.appendChild(backupSection);

            document.getElementById('download-backup').addEventListener('click', () => {
                this.downloadBackup();
            });

            document.getElementById('import-backup-btn').addEventListener('click', () => {
                document.getElementById('import-backup').click();
            });

            document.getElementById('import-backup').addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.importBackup(e.target.files[0]);
                }
            });

            document.getElementById('migrate-old-data').addEventListener('click', () => {
                if (this.migrateOldData()) {
                    alert('✅ Stare dane zostały zmigrowane!');
                    this.renderAll();
                } else {
                    alert('ℹ️ Nie znaleziono starych danych do migracji');
                }
            });

            document.getElementById('cleanup-old-data').addEventListener('click', () => {
                if (confirm('⚠️ Czy na pewno chcesz usunąć stare dane z localStorage?\n\nUpewnij się, że nowe dane zostały już załadowane!')) {
                    this.cleanupOldData();
                    alert('✅ Stare dane zostały usunięte');
                }
            });
        }
    }

    handleSaveTask() {
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
            dueDate: document.getElementById('task-date').value,
            dueTime: document.getElementById('task-time').value,
            priority: document.getElementById('task-priority').value,
            category: document.getElementById('task-category').value,
            reminderOffset: parseInt(document.getElementById('reminder-time').value),
            recurring: document.getElementById('recurring-task').checked,
            recurringType: document.getElementById('recurring-type').value,
            subtasks
        };

        this.addTask(taskData);
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

    handleSaveCategory() {
        const name = document.getElementById('new-category-name').value.trim();
        const color = document.getElementById('new-category-color').value;

        if (!name) {
            alert('Wprowadź nazwę kategorii');
            return;
        }

        const category = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            color
        };

        this.data.categories.push(category);
        this.saveData();
        this.renderSettings();

        document.getElementById('category-modal').classList.remove('show');
        document.getElementById('new-category-name').value = '';
        document.getElementById('new-category-color').value = '#2196F3';
    }

    deleteCategory(categoryId) {
        if (this.data.categories.length <= 1) return;

        this.data.categories = this.data.categories.filter(c => c.id !== categoryId);
        this.saveData();
        this.renderSettings();
    }

    switchView(viewName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;
    }

    // === SPEECH ===
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
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
            };
        }
    }

    processVoiceCommand(transcript) {
        const taskInput = document.getElementById('task-input');

        // Set priority
        if (transcript.includes('priorytet wysoki') || transcript.includes('wysoki priorytet')) {
            document.getElementById('task-priority').value = 'wysoki';
        } else if (transcript.includes('priorytet średni') || transcript.includes('średni priorytet')) {
            document.getElementById('task-priority').value = 'średni';
        } else if (transcript.includes('priorytet niski') || transcript.includes('niski priorytet')) {
            document.getElementById('task-priority').value = 'niski';
        }

        // Set category
        this.data.categories.forEach(category => {
            if (transcript.includes(category.name.toLowerCase())) {
                document.getElementById('task-category').value = category.id;
            }
        });

        // Set reminder
        if (transcript.includes('5 minut wcześniej')) {
            document.getElementById('reminder-time').value = '5';
        } else if (transcript.includes('15 minut wcześniej')) {
            document.getElementById('reminder-time').value = '15';
        } else if (transcript.includes('godzinę wcześniej')) {
            document.getElementById('reminder-time').value = '60';
        }

        // Set recurring
        if (transcript.includes('codziennie')) {
            document.getElementById('recurring-task').checked = true;
            document.getElementById('recurring-type').disabled = false;
            document.getElementById('recurring-type').value = 'daily';
        } else if (transcript.includes('co tydzień')) {
            document.getElementById('recurring-task').checked = true;
            document.getElementById('recurring-type').disabled = false;
            document.getElementById('recurring-type').value = 'weekly';
        }

        // Add text
        if (!taskInput.value) {
            taskInput.value = transcript;
        } else {
            taskInput.value += ' ' + transcript;
        }
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
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new My2DoSimple();
});