const CACHE_NAME = 'my2do-v2.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
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
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Sprawdzanie i wysyłanie powiadomień
self.addEventListener('sync', event => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndSendReminders());
  }
});

async function checkAndSendReminders() {
  const db = await openDB();
  const tx = db.transaction(['tasks'], 'readonly');
  const store = tx.objectStore('tasks');
  const tasks = await store.getAll();

  const now = new Date();

  for (const task of tasks) {
    if (task.reminder && !task.completed && !task.reminderSent) {
      const reminderTime = new Date(task.reminder);

      if (now >= reminderTime) {
        await self.registration.showNotification(`Przypomnienie: ${task.title}`, {
          body: task.description || 'Czas na wykonanie zadania',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: `task-${task.id}`,
          data: { taskId: task.id },
          requireInteraction: true,
          actions: [
            {
              action: 'complete',
              title: 'Oznacz jako wykonane'
            },
            {
              action: 'snooze',
              title: 'Przypomnij za 10 min'
            }
          ]
        });

        // Oznacz przypomnienie jako wysłane
        const writeTx = db.transaction(['tasks'], 'readwrite');
        const writeStore = writeTx.objectStore('tasks');
        task.reminderSent = true;
        await writeStore.put(task);
      }
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('My2DoDatabase', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}