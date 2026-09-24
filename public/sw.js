const isLocal = ['localhost', '127.0.0.1'].includes(self.location.hostname);

if (isLocal) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
} else {
  const CACHE_NAME = 'momentum-cache-v2';
  const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/favicon.ico',
    '/manifest.webmanifest'
  ];

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      )
    );
    self.clients.claim();
  });

  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/@') || url.search.includes('?v=')) return;

    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    ));
  });
}

