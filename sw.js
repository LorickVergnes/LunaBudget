const CACHE_NAME = 'luna-budget-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', () => {
  // En mode dev, on laisse passer les requêtes sans cache pour éviter les erreurs
  return;
});
