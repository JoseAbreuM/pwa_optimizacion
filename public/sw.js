const CACHE_NAME = 'petrofield-cache-v5';

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

function createOfflineFallbackResponse() {
  return new Response(`
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
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  });
}

function isDynamicNetworkFirstRoute(url) {
  if (url.origin !== self.location.origin) return false;

  return DYNAMIC_NETWORK_FIRST_ROUTES.some((route) => (
    url.pathname === route ||
    url.pathname.startsWith(`${route}/`)
  ));
}

function isStaticAppAsset(url) {
  if (url.origin !== self.location.origin) return false;

  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json'
  );
}

async function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[SW] No se pudo guardar en cache:', request.url, error);
  }
}

async function getCachedOrFallback(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const login = await caches.match('/login');
  if (login) return login;

  return createOfflineFallbackResponse();
}

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        FILES_TO_CACHE.map((file) => cache.add(file))
      ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /**
   * Las APIs dinámicas no se cachean.
   * Los datos offline se manejan con IndexedDB desde /js/offline/*.
   */
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;

  /**
   * Rutas dinámicas principales:
   * network-first, guardando copia cuando hay internet.
   */
  if (isDynamicNetworkFirstRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response);
          return response;
        })
        .catch(() => getCachedOrFallback(event.request))
    );

    return;
  }

  /**
   * Navegación general:
   * network-first con fallback a cache/login/offline.
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response);
          return response;
        })
        .catch(() => getCachedOrFallback(event.request))
    );

    return;
  }

  /**
   * Assets locales:
   * network-first para refrescar versiones, fallback a cache.
   */
  if (isStaticAppAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );

    return;
  }

  /**
   * Resto:
   * cache-first con actualización si se consigue red.
   */
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then(async (response) => {
            await putInCache(event.request, response);
            return response;
          })
          .catch(() => caches.match('/') || createOfflineFallbackResponse());
      })
  );
});