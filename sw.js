const CACHE_NAME = 'wod20-sheet-86050af261';
const CORE_ASSETS = [
  './',
  './index.html'
];
const OPTIONAL_ASSETS = [
  './dice3d.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/refresh.css',
  './assets/css/print.css',
  './assets/css/dice3d.css',
  './assets/js/app.js',
  './assets/js/rules.js',
  './assets/js/guide.js',
  './assets/js/dice.js',
  './assets/js/dice3d.js',
  './assets/js/dice3d-page.js',
  './assets/js/creation.js',
  './assets/js/print-prep.js',
  './assets/js/ux.js',
  './assets/js/hydrate.js',
  './assets/js/import-guard.js',
  './assets/js/share-codec.js',
  './assets/js/sampleCharacters.js',
  './assets/img/dark_pack_logo.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png'
];

// A new version waits until the page asks it to take over (the page shows "Reload"),
// so an open sheet is never swapped out mid-edit.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k.startsWith('wod20-sheet-')).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GETs: answer from cache at once,
// refresh the cached copy in the background. Pages fall back to index.html offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(req, response.clone());
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    try {
      return await network;
    } catch (e) {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
