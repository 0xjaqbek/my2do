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
        this.notificationCheckInterval = null;

        this.init();
    }

    // === STORAGE ===
    saveData() {
        try {
            const dataString = JSON.stringify(this.data, null, 2);

            // Multi-layer storage for mobile PWA reliability
            localStorage.setItem(this.storageKey, dataString);
            localStorage.setItem(`${this.storageKey}-backup`, dataString);
            localStorage.setItem(`${this.storageKey}-timestamp`, Date.now().toString());

            // Also save to sessionStorage as additional fallback
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(this.storageKey, dataString);
            }

            const debugInfo = {
                todo: this.data.todo.length,
                done: this.data.done.length,
                timestamp: new Date().toLocaleString(),
                isPWA: window.matchMedia('(display-mode: standalone)').matches,
                userAgent: navigator.userAgent.substring(0, 50)
            };

            console.log('💾 Data saved successfully:', debugInfo);

            // Auto-backup every 5 saves for mobile reliability
            const saveCount = parseInt(localStorage.getItem('saveCount') || '0') + 1;
            localStorage.setItem('saveCount', saveCount.toString());

            if (saveCount % 5 === 0) {
                console.log('📁 Creating auto-backup (save #' + saveCount + ')');
                // Auto-backup: not user-initiated
                this.downloadBackup(false);
            }

            return true;
        } catch (error) {
            console.error('❌ Error saving data:', error);
            this.logStorageDebug();
            return false;
        }
    }

    loadData() {
        try {
            console.log('📖 Starting data load process...', {
                isPWA: window.matchMedia('(display-mode: standalone)').matches,
                isMobile: this.isMobile(),
                timestamp: new Date().toLocaleString()
            });

            // Multi-source loading for reliability
            let dataString = localStorage.getItem(this.storageKey);
            let source = 'primary';

            // If primary fails, try backup
            if (!dataString) {
                dataString = localStorage.getItem(`${this.storageKey}-backup`);
                source = 'backup';
            }

            // If localStorage fails, try sessionStorage
            if (!dataString && typeof sessionStorage !== 'undefined') {
                dataString = sessionStorage.getItem(this.storageKey);
                source = 'session';
            }

            if (dataString) {
                const loadedData = JSON.parse(dataString);

                // Merge loaded data with defaults to handle new properties
                this.data = {
                    ...this.data,
                    ...loadedData,
                    settings: { ...this.data.settings, ...loadedData.settings },
                    categories: loadedData.categories || this.data.categories
                };

                const loadInfo = {
                    source: source,
                    todo: this.data.todo.length,
                    done: this.data.done.length,
                    lastSave: new Date(parseInt(localStorage.getItem(`${this.storageKey}-timestamp`) || '0')).toLocaleString()
                };

                console.log('✅ Data loaded successfully:', loadInfo);

                // If loaded from backup/session, immediately save to primary
                if (source !== 'primary') {
                    console.log('🔄 Restoring from', source, 'to primary localStorage...');
                    this.saveData();
                }

                return true;
            }

            // If no new format, try to migrate from old format
            console.log('🔄 No new format data found, attempting migration...');
            if (this.migrateOldData()) {
                console.log('✅ Old data migrated successfully');
                return true;
            }

        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.logStorageDebug();
        }

        console.log('ℹ️ No existing data found, starting fresh');
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

    downloadBackup(userInitiated = false) {
        const dataString = JSON.stringify(this.data, null, 2);

        // On mobile, only allow user-initiated downloads
        if (this.isMobile() && !userInitiated) {
            console.log('📱 Skipping auto-download on mobile - user must initiate');
            return false;
        }

        try {
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `my2do-backup-${new Date().toISOString().split('T')[0]}.json`;

            // Mobile-specific handling
            if (this.isMobile()) {
                // On mobile, add additional attributes for better compatibility
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener');

                // Add a slight delay to ensure user gesture is preserved
                setTimeout(() => {
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            } else {
                // Desktop handling
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            console.log('💾 Backup file downloaded');
            return true;
        } catch (error) {
            console.error('❌ Error downloading backup:', error);

            // Fallback for mobile: copy to clipboard
            if (this.isMobile()) {
                this.copyDataToClipboard(dataString);
            }
            return false;
        }
    }

    copyDataToClipboard(dataString) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(dataString).then(() => {
                alert('📋 Dane zostały skopiowane do schowka!\n\nWklej je do pliku tekstowego, aby zapisać kopię zapasową.');
                console.log('📋 Data copied to clipboard as fallback');
            }).catch(err => {
                console.error('❌ Failed to copy to clipboard:', err);
                this.showDataModal(dataString);
            });
        } else {
            // Fallback: show data in modal for manual copy
            this.showDataModal(dataString);
        }
    }

    showDataModal(dataString) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>Kopia zapasowa danych</h3>
                <p>Skopiuj poniższe dane i zapisz je w pliku .json:</p>
                <textarea readonly style="width:100%; height:200px; font-family:monospace; font-size:12px;">${dataString}</textarea>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="navigator.clipboard.writeText(\`${dataString.replace(/`/g, '\\`')}\`).then(() => alert('Skopiowano!')).catch(() => alert('Zaznacz i skopiuj ręcznie'))">Skopiuj</button>
                    <button class="btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Zamknij</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        console.log('📄 Data shown in modal for manual copy');
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

        // Setup notifications
        await this.setupNotifications();

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
            createdAt: new Date().toISOString(),
            reminderSent: false
        };

        // Set reminder time if needed
        if (task.dueDate && task.dueTime && task.reminderOffset > 0) {
            const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
            task.reminderTime = new Date(dueDateTime.getTime() - (task.reminderOffset * 60000)).toISOString();

            console.log('⏰ Task created with reminder:', {
                title: task.title,
                dueDate: task.dueDate,
                dueTime: task.dueTime,
                reminderOffset: task.reminderOffset,
                reminderTime: new Date(task.reminderTime).toLocaleString(),
                timeUntilReminder: Math.round((new Date(task.reminderTime).getTime() - Date.now()) / 1000 / 60) + ' minutes'
            });
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

        // Add mobile PWA notification status
        this.updateNotificationStatus();

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

        document.getElementById('enable-notifications').addEventListener('change', async (e) => {
            this.saveSetting('notificationsEnabled', e.target.checked);

            if (e.target.checked) {
                // Request permission and start checking
                if ('Notification' in window) {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        this.startNotificationChecking();
                        console.log('✅ Notifications enabled and checking started');

                        // Mobile PWA: Also setup enhanced mobile handling
                        if (this.isMobile() && window.matchMedia('(display-mode: standalone)').matches) {
                            this.setupMobilePWANotifications();
                        }
                    } else {
                        console.warn('⚠️ Notification permission denied');
                        e.target.checked = false;
                        this.saveSetting('notificationsEnabled', false);
                    }
                }
            } else {
                // Stop checking
                this.stopNotificationChecking();
                console.log('🔕 Notifications disabled and checking stopped');
            }

            // Update status indicator
            this.updateNotificationStatus();
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
            const isMobile = this.isMobile();
            backupSection.innerHTML = `
                <h3>Backup danych</h3>
                <button id="download-backup" class="btn-primary">
                    ${isMobile ? '📋 Skopiuj dane' : 'Pobierz kopię zapasową'}
                </button>
                ${isMobile ? '<p style="font-size:12px; color:var(--text-secondary); margin:5px 0;">Na urządzeniach mobilnych dane zostaną skopiowane do schowka</p>' : ''}
                <input type="file" id="import-backup" accept=".json" style="display: none;">
                <button id="import-backup-btn" class="btn-secondary">Importuj kopię zapasową</button>
                <button id="migrate-old-data" class="btn-secondary">Migruj stare dane</button>
                <button id="cleanup-old-data" class="btn-secondary">Wyczyść stare dane</button>
            `;
            settingsContainer.appendChild(backupSection);

            document.getElementById('download-backup').addEventListener('click', () => {
                // Manual download: user-initiated
                this.downloadBackup(true);
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

    // === UTILITY METHODS ===
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    logStorageDebug() {
        console.log('🔍 Storage Debug Info:', {
            localStorage_available: typeof(Storage) !== "undefined",
            localStorage_quota: this.getStorageQuota(),
            current_keys: this.getStorageKeys(),
            data_size: this.getDataSize(),
            isPWA: window.matchMedia('(display-mode: standalone)').matches,
            isMobile: this.isMobile(),
            userAgent: navigator.userAgent
        });
    }

    getStorageQuota() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                navigator.storage.estimate().then(estimate => {
                    console.log('💾 Storage Estimate:', {
                        quota: Math.round(estimate.quota / 1024 / 1024) + ' MB',
                        usage: Math.round(estimate.usage / 1024) + ' KB'
                    });
                });
            }
            return 'Checking async...';
        } catch (e) {
            return 'Not available';
        }
    }

    getStorageKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('my2do')) {
                keys.push(key);
            }
        }
        return keys;
    }

    getDataSize() {
        try {
            const dataString = localStorage.getItem(this.storageKey);
            return dataString ? Math.round(dataString.length / 1024 * 100) / 100 + ' KB' : '0 KB';
        } catch (e) {
            return 'Error calculating';
        }
    }

    // === NOTIFICATION SYSTEM ===
    async setupNotifications() {
        console.log('🔔 Setting up notification system...', {
            isPWA: window.matchMedia('(display-mode: standalone)').matches,
            isMobile: this.isMobile(),
            hasNotificationAPI: 'Notification' in window,
            hasServiceWorker: 'serviceWorker' in navigator
        });

        // Request notification permissions
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log('📱 Notification permission:', permission);

            if (permission === 'granted') {
                this.startNotificationChecking();

                // Mobile PWA: Also setup persistent background checking
                if (this.isMobile() && window.matchMedia('(display-mode: standalone)').matches) {
                    this.setupMobilePWANotifications();
                }
            }
        } else {
            console.warn('⚠️ Browser does not support notifications');
        }

        // Listen for messages from Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'REMINDER_SENT') {
                    console.log('📨 Received REMINDER_SENT for task:', event.data.taskId);
                    this.markReminderSent(event.data.taskId);
                }
            });
        }
    }

    setupMobilePWANotifications() {
        console.log('📱 Setting up mobile PWA-specific notification handling...');

        // More aggressive checking on mobile PWAs (every 30 seconds)
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
        }

        this.notificationCheckInterval = setInterval(() => {
            this.checkReminders();
        }, 30000); // 30 seconds for mobile PWA

        // Additional mobile-specific event listeners
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('📱 PWA came to foreground - checking reminders...');
                this.checkReminders();
            }
        });

        // Also check when PWA gains focus
        window.addEventListener('focus', () => {
            console.log('📱 PWA gained focus - checking reminders...');
            this.checkReminders();
        });

        // Force persistent Service Worker registration on mobile
        if ('serviceWorker' in navigator) {
            this.ensureServiceWorkerActive();
        }

        console.log('✅ Mobile PWA notification setup complete');
    }

    async ensureServiceWorkerActive() {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                console.log('📱 Service Worker registration found:', registration.active ? 'active' : 'not active');

                // If SW is not active, try to activate it
                if (!registration.active && registration.installing) {
                    console.log('📱 Waiting for Service Worker to install...');
                    await new Promise(resolve => {
                        registration.installing.addEventListener('statechange', () => {
                            if (registration.installing.state === 'activated') {
                                resolve();
                            }
                        });
                    });
                }

                // Send a ping to ensure SW is responsive
                if (registration.active) {
                    registration.active.postMessage({ type: 'PING' });
                    console.log('📱 Pinged Service Worker to ensure it\'s responsive');
                }
            }
        } catch (error) {
            console.error('❌ Error ensuring Service Worker active:', error);
        }
    }

    startNotificationChecking() {
        // Clear any existing interval
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
        }

        // Check reminders every minute
        this.notificationCheckInterval = setInterval(() => {
            this.checkReminders();
        }, 60000); // 60 seconds

        // Initial check
        this.checkReminders();
        console.log('⏰ Notification checking started (60s intervals)');
    }

    stopNotificationChecking() {
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
            this.notificationCheckInterval = null;
            console.log('🛑 Notification checking stopped');
        }
    }

    checkReminders() {
        if (!this.data.settings.notificationsEnabled) {
            console.log('🔕 Notifications disabled in settings');
            return;
        }

        const now = new Date();
        const isMobilePWA = this.isMobile() && window.matchMedia('(display-mode: standalone)').matches;

        console.log('⏰ Checking for due reminders...', {
            timestamp: now.toLocaleString(),
            isMobilePWA: isMobilePWA,
            visibility: document.visibilityState,
            notificationPermission: Notification.permission
        });

        // Get all tasks with reminders
        const tasksWithReminders = this.data.todo.filter(task =>
            task.reminderTime && !task.reminderSent
        );

        if (tasksWithReminders.length === 0) {
            console.log('📝 No pending reminders');
            return;
        }

        console.log(`📝 Found ${tasksWithReminders.length} tasks with reminders:`);
        tasksWithReminders.forEach(task => {
            const reminderTime = new Date(task.reminderTime);
            const timeDiff = reminderTime.getTime() - now.getTime();
            console.log(`  - ${task.title}: reminder at ${reminderTime.toLocaleString()}, ${Math.round(timeDiff/1000/60)}min remaining`);
        });

        // Mobile PWA: Always use fallback for more reliability
        if (isMobilePWA) {
            console.log('📱 Using fallback notifications for mobile PWA');
            this.handleRemindersFallback(tasksWithReminders);
            return;
        }

        // Desktop/Browser: Try Service Worker first
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_REMINDERS',
                tasks: tasksWithReminders
            });
            console.log('📨 Sent reminders to Service Worker');

            // Fallback timeout for mobile reliability
            setTimeout(() => {
                console.log('🔄 Fallback check after SW message...');
                this.handleRemindersFallback(tasksWithReminders);
            }, 5000);
        } else {
            console.log('🔄 Service Worker not available, using fallback');
            this.handleRemindersFallback(tasksWithReminders);
        }
    }

    handleRemindersFallback(tasks) {
        const now = new Date();
        console.log('🔄 Handling reminders in main thread (SW fallback)');

        tasks.forEach(task => {
            if (task.reminderTime && !task.reminderSent) {
                const reminderTime = new Date(task.reminderTime);
                const timeDiff = reminderTime.getTime() - now.getTime();

                console.log(`📝 Task: ${task.title}, Reminder: ${reminderTime.toLocaleString()}, Time diff: ${timeDiff}ms`);

                // Show notification if reminder time has passed
                if (timeDiff <= 0 && timeDiff > -60000) {
                    console.log('🚨 Showing notification for task:', task.title);

                    if ('Notification' in window && Notification.permission === 'granted') {
                        const notification = new Notification(`Przypomnienie: ${task.title}`, {
                            body: task.description || `Zaplanowane na: ${task.dueDate} ${task.dueTime}`,
                            icon: './icons/icon-192x192.png',
                            tag: `task-${task.id}`,
                            requireInteraction: true
                        });

                        notification.onclick = () => {
                            window.focus();
                            notification.close();
                        };

                        this.markReminderSent(task.id);
                    }
                }
            }
        });
    }

    markReminderSent(taskId) {
        console.log('✅ Marking reminder as sent for task:', taskId);

        // Find and update the task
        const taskIndex = this.data.todo.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            this.data.todo[taskIndex].reminderSent = true;
            this.saveData();
            console.log('💾 Reminder marked as sent and saved');
        } else {
            console.warn('⚠️ Task not found for marking reminder sent:', taskId);
        }
    }

    updateNotificationStatus() {
        // Remove existing status if present
        const existingStatus = document.getElementById('notification-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Create status indicator
        const statusDiv = document.createElement('div');
        statusDiv.id = 'notification-status';
        statusDiv.style.cssText = 'margin-top: 10px; padding: 8px; border-radius: 4px; font-size: 12px;';

        const isMobilePWA = this.isMobile() && window.matchMedia('(display-mode: standalone)').matches;
        const permission = 'Notification' in window ? Notification.permission : 'not-supported';
        const isEnabled = this.data.settings.notificationsEnabled;

        let statusText = '';
        let statusClass = '';

        if (!('Notification' in window)) {
            statusText = '⚠️ Powiadomienia nie są obsługiwane w tej przeglądarce';
            statusClass = 'warning';
        } else if (permission === 'denied') {
            statusText = '❌ Powiadomienia zostały zablokowane. Włącz je w ustawieniach przeglądarki.';
            statusClass = 'error';
        } else if (permission === 'default') {
            statusText = '🔔 Kliknij checkbox powyżej, aby włączyć powiadomienia';
            statusClass = 'info';
        } else if (permission === 'granted' && isEnabled) {
            if (isMobilePWA) {
                statusText = '✅ Powiadomienia włączone (tryb mobilny PWA - 30s interwał)';
                statusClass = 'success';
            } else {
                statusText = '✅ Powiadomienia włączone (60s interwał)';
                statusClass = 'success';
            }
        } else if (permission === 'granted' && !isEnabled) {
            statusText = '🔕 Powiadomienia dostępne, ale wyłączone w ustawieniach aplikacji';
            statusClass = 'info';
        }

        // Apply styling based on status
        switch (statusClass) {
            case 'success':
                statusDiv.style.backgroundColor = 'var(--success-color)';
                statusDiv.style.color = 'white';
                break;
            case 'warning':
                statusDiv.style.backgroundColor = 'var(--warning-color)';
                statusDiv.style.color = 'white';
                break;
            case 'error':
                statusDiv.style.backgroundColor = 'var(--error-color)';
                statusDiv.style.color = 'white';
                break;
            case 'info':
                statusDiv.style.backgroundColor = 'var(--primary-light)';
                statusDiv.style.color = 'var(--primary-dark)';
                break;
        }

        statusDiv.textContent = statusText;

        // Insert after the notification setting
        const notificationSetting = document.getElementById('enable-notifications').closest('.setting-item');
        notificationSetting.parentNode.insertBefore(statusDiv, notificationSetting.nextSibling);
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new My2DoSimple();

    // Add comprehensive PWA lifecycle handling for mobile data persistence
    console.log('📱 Setting up PWA lifecycle handlers...');

    // Save data before page unload (critical for mobile)
    window.addEventListener('beforeunload', () => {
        console.log('⚠️ Page unloading - force saving data...');
        if (app) {
            app.saveData();
        }
    });

    // Save data when app goes to background (mobile PWA)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.log('👁️ App going to background - saving data...');
            if (app) {
                app.saveData();
            }
        } else {
            console.log('👁️ App coming to foreground - reloading data...');
            if (app) {
                // Reload data in case it was lost
                app.loadData();
                app.renderAll();
            }
        }
    });

    // Save data when PWA is paused/resumed (mobile specific)
    window.addEventListener('pagehide', () => {
        console.log('📱 PWA pausing - emergency save...');
        if (app) {
            app.saveData();
        }
    });

    window.addEventListener('pageshow', (event) => {
        console.log('📱 PWA resuming - checking data integrity...');
        if (app && event.persisted) {
            // Page was restored from bfcache, reload data
            app.loadData();
            app.renderAll();
        }
    });

    // Handle focus/blur for desktop/mobile compatibility
    window.addEventListener('focus', () => {
        console.log('🎯 Window focused - verifying data...');
        if (app) {
            // Quick data verification on focus
            const hasData = localStorage.getItem(app.storageKey);
            if (!hasData && (app.data.todo.length > 0 || app.data.done.length > 0)) {
                console.warn('⚠️ Data mismatch detected - emergency save...');
                app.saveData();
            }
        }
    });

    // Periodic data backup for mobile reliability (every 30 seconds)
    setInterval(() => {
        if (app && (app.data.todo.length > 0 || app.data.done.length > 0)) {
            console.log('🔄 Periodic backup check...');
            const lastSave = localStorage.getItem(`${app.storageKey}-timestamp`);
            const now = Date.now();
            if (!lastSave || (now - parseInt(lastSave)) > 30000) {
                console.log('💾 Performing periodic backup...');
                app.saveData();
            }
        }
    }, 30000);

    // Log PWA installation state
    console.log('📊 PWA Status:', {
        isInstalled: window.matchMedia('(display-mode: standalone)').matches,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        hasServiceWorker: 'serviceWorker' in navigator,
        storageAvailable: typeof(Storage) !== "undefined"
    });
});