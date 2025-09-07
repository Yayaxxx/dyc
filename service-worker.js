/*
 * Service Worker for the Inventory Web App
 *
 * Implements a simple cache‑first strategy for offline use. When the app is
 * installed and the service worker is registered, the core assets (HTML,
 * JavaScript, CSS and the manifest) are cached. Subsequent network requests
 * will try to serve from the cache first, falling back to the network when
 * needed. This allows the application shell to load even without internet
 * connectivity.
 */

const CACHE_NAME = 'inventory-app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches if necessary
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => {
          // As a fallback, return a generic response for failed requests. In a
          // real application, you might want to return a fallback page or
          // cached asset here.
          return new Response('Hors ligne', {
            status: 503,
            statusText: 'Hors ligne',
          });
        });
    })
  );
});