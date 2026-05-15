const CACHE_NAME = 'petrofield-cache-v4';

const FILES_TO_CACHE = [
  '/',
  '/login',
  '/css/app.css',
  '/js/sw-register.js',
  '/js/core/app.js',
  '/js/core/ui.js',
  '/js/offline/db.js',
  '/js/offline/store.js',
  '/js/offline/sync.js',
  '/js/offline/status.js',
  '/js/modules/pozos.js',
  '/js/modules/muestras.js',
  '/js/modules/parametros.js',
  '/js/modules/niveles.js',
  '/assets/icons/icono.png',
  '/manifest.json'
];

const DYNAMIC_NETWORK_FIRST_ROUTES = [
  '/dashboard',
  '/pozos',
  '/optimizacion',
  '/operaciones',
  '/mantenimiento'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.allSettled(FILES_TO_CACHE.map(file => cache.add(file))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;

  if (
    url.origin === self.location.origin &&
    DYNAMIC_NETWORK_FIRST_ROUTES.some((route) => url.pathname === route || url.pathname.startsWith(`${route}/`))
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          return cached || caches.match('/login') || new Response('<h1>Sin conexión</h1><p>Necesitas internet para ver esta página.</p>', { headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  const isStaticAppAsset = url.origin === self.location.origin && (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json'
  );

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          return cached || caches.match('/login');
        })
    );
    return;
  }

  if (isStaticAppAsset) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
