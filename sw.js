/**
 * MISRA COFFEE — High Performance Web Application Service Worker
 * Provides offline caching, lightning-fast app shell loading, and asset caching.
 */

const CACHE_NAME = 'misra-coffee-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/services.html',
  '/about.html',
  '/menu.html',
  '/admin-login.html',
  '/style.css',
  '/qr-platform.css',
  '/script.js',
  '/menu-app.js',
  '/manifest.json',
  '/images/app-icon.svg',
  '/images/somali-coffee.jpg',
  '/images/breakfast.jpg',
  '/images/lunch-dinner.jpg',
  '/images/snacks.jpg',
  '/images/drinks.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache API endpoints or admin modifications
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/menu.html') || caches.match('/');
          }
        });
      })
  );
});
