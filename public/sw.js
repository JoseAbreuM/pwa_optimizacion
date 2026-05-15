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
  '/js/modules/pozo-detalle.js',
  '/js/modules/dashboard.js',
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
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          return cached || caches.match('/login') || new Response(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Sin conexión</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  min-height: 100vh;
                  margin: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #0f172a;
                  color: #e2e8f0;
                  text-align: center;
                  padding: 24px;
                }

                .card {
                  max-width: 420px;
                  border: 1px solid #334155;
                  border-radius: 16px;
                  padding: 24px;
                  background: #111827;
                }

                h1 {
                  margin-top: 0;
                  font-size: 1.5rem;
                }

                p {
                  color: #cbd5e1;
                  line-height: 1.5;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Sin conexión</h1>
                <p>Necesitas internet para ver esta página por primera vez.</p>
                <p>Cuando recuperes conexión, la PWA actualizará los datos automáticamente.</p>
              </div>
            </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
          });
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
