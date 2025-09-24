/*
  Simple service worker for Flok
  - Precache app shell (index.html)
  - Network-first for navigations
  - Stale-while-revalidate for static assets
*/
const CACHE = 'flok-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Navigations: network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('/');
        return cached || Response.error();
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (request.destination && ['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => {
          cache.put(request, res.clone());
          return res;
        }).catch(() => undefined);
        return cached || network || fetch(request);
      })
    );
  }
});

