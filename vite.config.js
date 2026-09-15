import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function serviceWorkerPrecache() {
  return {
    name: 'momentum-service-worker-precache',
    writeBundle(options, bundle) {
      const assets = [...new Set(Object.keys(bundle)
        .filter(fileName => fileName !== 'sw.js' && fileName !== 'index.html')
        .map(fileName => `/${fileName}`))];
      const source = `const CACHE_NAME = 'momentum-cache-v2';\nconst PRECACHE = ${JSON.stringify(['/', '/index.html', '/favicon.svg', '/favicon.ico', '/manifest.webmanifest', ...assets])};\nself.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())));\nself.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));\nself.addEventListener('fetch', event => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())); return response; }))); });\n`;
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
