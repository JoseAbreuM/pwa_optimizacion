const CACHE_NAME = 'petrofield-cache-v6';

const FILES_TO_CACHE = [
  '/',
  '/login',
  '/offline.html',

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
  '/mantenimiento',
  '/parametros',
  '/niveles',
  '/muestras',
  '/servicios'
];

function createOfflineFallbackResponse() {
  return new Response(
    `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sin conexión - PetroField</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: grid;
      min-height: 100vh;
      place-items: center;
      padding: 24px;
    }
    .card {
      max-width: 460px;
      border: 1px solid #334155;
      border-radius: 20px;
      background: #020617;
      padding: 24px;
      box-shadow: 0 18px 45px rgba(0,0,0,.35);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
    }
    p {
      color: #94a3b8;
      line-height: 1.5;
    }
    a, button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 999px;
      background: #033F73;
      color: white;
      padding: 10px 16px;
      text-decoration: none;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Sin conexión</h1>
    <p>No se pudo cargar esta página desde la red. Puedes intentar abrir el modo offline si ya sincronizaste datos anteriormente.</p>
    <a href="/offline.html">Abrir modo offline</a>
  </main>
</body>
</html>
`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      }
    }
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isDynamicNetworkFirstRoute(url) {
  if (!isSameOrigin(url)) return false;

  return DYNAMIC_NETWORK_FIRST_ROUTES.some((route) => (
    url.pathname === route ||
    url.pathname.startsWith(`${route}/`)
  ));
}

function isStaticAppAsset(url) {
  if (!isSameOrigin(url)) return false;

  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/offline.html'
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

async function getOfflinePage() {
  const cachedOffline = await caches.match('/offline.html', {
    ignoreSearch: true
  });

  if (cachedOffline) return cachedOffline;

  return createOfflineFallbackResponse();
}

async function getCachedOrOfflinePage(request) {
  const cached = await caches.match(request, {
    ignoreSearch: true
  });

  if (cached) return cached;

  return getOfflinePage();
}

async function getCachedAssetOrFallback(request) {
  const cached = await caches.match(request, {
    ignoreSearch: true
  });

  if (cached) return cached;

  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch (error) {
    return new Response('', {
      status: 504,
      statusText: 'Offline'
    });
  }
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

  if (event.request.method !== 'GET') return;

  /**
   * APIs:
   * No se cachean aquí. Los datos offline se guardan en IndexedDB.
   */
  if (isSameOrigin(url) && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({
          ok: false,
          offline: true,
          message: 'Sin conexión. Usa los datos guardados localmente.'
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }
      ))
    );

    return;
  }

  /**
   * Rutas dinámicas principales:
   * network-first. Si no hay red, intenta cache. Si no hay cache, offline.html.
   */
  if (isDynamicNetworkFirstRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response);
          return response;
        })
        .catch(() => getCachedOrOfflinePage(event.request))
    );

    return;
  }

  /**
   * Navegación general:
   * network-first con fallback a offline.html.
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response);
          return response;
        })
        .catch(() => getCachedOrOfflinePage(event.request))
    );

    return;
  }

  /**
   * Assets locales:
   * cache-first para que la app abra rápido offline.
   */
  if (isStaticAppAsset(url)) {
    event.respondWith(getCachedAssetOrFallback(event.request));
    return;
  }

  /**
   * Resto:
   * cache-first con fallback mínimo.
   */
  event.respondWith(
    caches.match(event.request, {
      ignoreSearch: true
    })
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then(async (response) => {
            await putInCache(event.request, response);
            return response;
          })
          .catch(() => getOfflinePage());
      })
  );
});