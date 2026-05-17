const CACHE_NAME = 'petrofield-cache-v7';

const APP_SHELL_FILES = [
  '/offline.html',

  '/css/app.css',
  '/css/tailwind.css',

  '/js/sw-register.js',
  '/js/app-theme.js',
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

const NAVIGATION_FALLBACK_ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/pozos',
  '/parametros',
  '/niveles',
  '/muestras',
  '/servicios'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return isSameOrigin(url) && url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  if (!isSameOrigin(url)) return false;

  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/offline.html'
  );
}

async function openAppCache() {
  return caches.open(CACHE_NAME);
}

async function safeCachePut(request, response) {
  if (!response || response.status !== 200) return;

  try {
    const cache = await openAppCache();
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[SW] No se pudo guardar en cache:', request.url || request, error);
  }
}

async function cacheAppShell() {
  const cache = await openAppCache();

  for (const file of APP_SHELL_FILES) {
    try {
      const request = new Request(file, {
        cache: 'reload'
      });

      const response = await fetch(request);

      if (response.ok) {
        await cache.put(file, response);
      } else {
        console.warn('[SW] No se precacheó:', file, response.status);
      }
    } catch (error) {
      console.warn('[SW] Error precacheando:', file, error);
    }
  }
}

async function getOfflineFallback() {
  const cachedOffline = await caches.match('/offline.html', {
    ignoreSearch: true
  });

  if (cachedOffline) return cachedOffline;

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
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #020617;
      color: #e2e8f0;
      padding: 24px;
    }

    main {
      max-width: 460px;
      border: 1px solid #334155;
      border-radius: 20px;
      background: #0f172a;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
    }

    p {
      color: #94a3b8;
      line-height: 1.5;
    }

    a {
      display: inline-flex;
      margin-top: 12px;
      border-radius: 999px;
      background: #033F73;
      color: #fff;
      padding: 10px 16px;
      text-decoration: none;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <h1>Sin conexión</h1>
    <p>No se pudo abrir la PWA desde la red. Abre el modo offline para consultar la última información guardada.</p>
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

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await safeCachePut(request, response);
    }

    return response;
  } catch (error) {
    const cachedExact = await caches.match(request, {
      ignoreSearch: true
    });

    if (cachedExact) return cachedExact;

    const url = new URL(request.url);

    for (const route of NAVIGATION_FALLBACK_ROUTES) {
      if (url.pathname === route || url.pathname.startsWith(`${route}/`)) {
        const cachedRoute = await caches.match(route, {
          ignoreSearch: true
        });

        if (cachedRoute) return cachedRoute;
      }
    }

    return getOfflineFallback();
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, {
    ignoreSearch: true
  });

  if (cached) return cached;

  try {
    const response = await fetch(request);

    await safeCachePut(request, response);

    return response;
  } catch (error) {
    return new Response('', {
      status: 504,
      statusText: 'Offline'
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheAppShell()
      .then(() => self.skipWaiting())
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isApiRequest(url)) {
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

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstAsset(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request, {
      ignoreSearch: true
    })
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then(async (response) => {
            await safeCachePut(event.request, response);
            return response;
          })
          .catch(() => getOfflineFallback());
      })
  );
});