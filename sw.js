const CACHE_NAME = 'my2do-v3.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './simple-script.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Obsługa powiadomień offline
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll().then(clientList => {
      // Try to focus existing window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('my2do') && 'focus' in client) {
          return client.focus();
        }
      }
      // If no existing window, open new one
      if (clients.openWindow) {
        return clients.openWindow('/my2do/');
      }
    })
  );
});

// Listen for messages from main thread
self.addEventListener('message', event => {
  console.log('📨 SW received message:', event.data.type);

  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    console.log('📨 Received CHECK_REMINDERS message with', event.data.tasks.length, 'tasks');
    checkAndSendReminders(event.data.tasks);
  }

  if (event.data && event.data.type === 'PING') {
    console.log('🏓 SW received PING - responding...');
    event.ports[0]?.postMessage({ type: 'PONG' });
  }
});

function checkAndSendReminders(tasks) {
  const now = new Date();
  console.log('⏰ Checking reminders at:', now.toLocaleString());

  tasks.forEach(task => {
    if (task.reminderTime && !task.completed && !task.reminderSent) {
      const reminderTime = new Date(task.reminderTime);
      const timeDiff = reminderTime.getTime() - now.getTime();

      console.log(`📝 Task: ${task.title}, Reminder: ${reminderTime.toLocaleString()}, Time diff: ${timeDiff}ms`);

      // Show notification if reminder time has passed (within 1 minute tolerance)
      if (timeDiff <= 0 && timeDiff > -60000) {
        console.log('🚨 Showing notification for task:', task.title);

        self.registration.showNotification(`Przypomnienie: ${task.title}`, {
          body: task.description || `Zaplanowane na: ${task.dueDate} ${task.dueTime}`,
          icon: './icons/icon-192x192.png',
          badge: './icons/icon-72x72.png',
          tag: `task-${task.id}`,
          data: { taskId: task.id },
          requireInteraction: true,
          actions: [
            {
              action: 'complete',
              title: '✅ Oznacz jako wykonane'
            },
            {
              action: 'snooze',
              title: '⏰ Przypomnij za 10 min'
            }
          ],
          vibrate: [200, 100, 200],
          timestamp: now.getTime()
        }).then(() => {
          console.log('✅ Notification shown successfully');
          // Send message back to mark as sent
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'REMINDER_SENT',
                taskId: task.id
              });
            });
          });
        }).catch(error => {
          console.error('❌ Failed to show notification:', error);
        });
      }
    }
  });
}