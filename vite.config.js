import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function serviceWorkerPrecache() {
  return {
    name: 'momentum-service-worker-precache',
    writeBundle(options, bundle) {
      const buildVersion = Date.now();
      const assets = [...new Set(Object.keys(bundle)
        .filter(fileName => fileName !== 'sw.js' && fileName !== 'index.html')
        .map(fileName => `/${fileName}`))];
      const source = `const CACHE_NAME = 'momentum-cache-v${buildVersion}';
const PRECACHE = ${JSON.stringify(['/favicon.svg', '/favicon.ico', '/manifest.webmanifest', ...assets])};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigation: NETWORK FIRST with fallback to cache (guarantees instant updates)
  const isHtml = event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/index.html'))
    );
    return;
  }

  // Static hashed assets: Cache first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
`;
      writeFileSync(resolve(options.dir, 'sw.js'), source);
    }
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPrecache()],
  server: {
    port: 3000,
    open: false
  }
});
