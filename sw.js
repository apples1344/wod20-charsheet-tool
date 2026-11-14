const CACHE_NAME = 'wod20-sheet-cache-v43';
const CORE_ASSETS = [
  './',
  './index.html'
];
const OPTIONAL_ASSETS = [
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/sampleCharacters.js',
  './assets/img/dark_pack_logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html'))
    )
  );
});
