const CACHE_NAME = 'petrofield-cache-v12';

const APP_SHELL_FILES = [
  /**
   * Páginas online cacheables.
   * Si el usuario ya inició sesión, estas rutas pueden quedar guardadas
   * para abrir la PWA cerrada completamente sin internet.
   */
  '/dashboard',
  '/pozos',

  /**
   * Fallbacks offline.
   */
  '/offline-app.html',
  '/offline.html',

  /**
   * Estilos locales.
   */
  '/css/app.css',
  '/css/tailwind.css',

  /**
   * Scripts core.
   */
  '/js/sw-register.js',
  '/js/app-theme.js',
  '/js/core/app.js',
  '/js/core/ui.js',

  /**
   * Scripts offline.
   */
  '/js/offline/db.js',
  '/js/offline/store.js',
  '/js/offline/sync.js',
  '/js/offline/status.js',
  '/js/offline/app-shell.js',

  /**
   * Scripts por módulo.
   */
  '/js/modules/pozos.js',
  '/js/modules/pozo-detalle.js',
  '/js/modules/dashboard.js',
  '/js/modules/muestras.js',
  '/js/modules/parametros.js',
  '/js/modules/niveles.js',

  /**
   * Assets.
   */
  '/assets/icons/icono.png',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',

  '/manifest.json'
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
    url.pathname === '/offline.html' ||
    url.pathname === '/offline-app.html'
  );
}

function isPozoDetailPath(pathname) {
  return /^\/pozos\/\d+\/?$/.test(pathname);
}

function isPozosPath(pathname) {
  return pathname === '/pozos' || pathname === '/pozos/';
}

function isDashboardPath(pathname) {
  return pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/';
}

function isHtmlResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

function isLoginHtmlResponse(request, response) {
  if (!response || !isHtmlResponse(response)) return false;

  const requestUrl = new URL(request.url);
  const responseUrl = response.url ? new URL(response.url) : null;

  return (
    requestUrl.pathname !== '/login' &&
    responseUrl &&
    responseUrl.pathname === '/login'
  );
}

async function openAppCache() {
  return caches.open(CACHE_NAME);
}

async function getCachedPath(path) {
  return caches.match(path, {
    ignoreSearch: true
  });
}

async function safeCachePut(request, response) {
  if (!response || response.status !== 200) return;

  if (isLoginHtmlResponse(request, response)) {
    console.warn('[SW] No se cacheó respuesta de login para:', request.url);
    return;
  }

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
        cache: 'reload',
        credentials: 'same-origin'
      });

      const response = await fetch(request);

      if (response.ok && !isLoginHtmlResponse(request, response)) {
        await cache.put(file, response.clone());
      } else {
        console.warn('[SW] No se precacheó:', file, response.status);
      }
    } catch (error) {
      console.warn('[SW] Error precacheando:', file, error);
    }
  }
}

async function getOfflineFallback(request = null) {
  const requestUrl = request ? new URL(request.url) : null;
  const pathname = requestUrl?.pathname || '';

  /**
   * 1. Primero intenta devolver exactamente la ruta solicitada.
   * Si /pozos/102 fue visitado online antes, devuelve esa ficha cacheada.
   */
  if (request) {
    const cachedExact = await caches.match(request, {
      ignoreSearch: true
    });

    if (cachedExact) return cachedExact;
  }

  /**
   * 2. Fichas /pozos/:id:
   * Nunca deben caer a /dashboard.
   * Si no existe la ficha HTML cacheada, se abre offline-app.html
   * para que app-shell.js renderice la ficha desde IndexedDB.
   */
  if (isPozoDetailPath(pathname)) {
    const cachedAppShell = await getCachedPath('/offline-app.html');

    if (cachedAppShell) return cachedAppShell;

    const cachedOffline = await getCachedPath('/offline.html');

    if (cachedOffline) return cachedOffline;

    const cachedPozos = await getCachedPath('/pozos');

    if (cachedPozos) return cachedPozos;
  }

  /**
   * 3. Listado de pozos.
   */
  if (isPozosPath(pathname)) {
    const cachedPozos = await getCachedPath('/pozos');

    if (cachedPozos) return cachedPozos;

    const cachedAppShell = await getCachedPath('/offline-app.html');

    if (cachedAppShell) return cachedAppShell;

    const cachedOffline = await getCachedPath('/offline.html');

    if (cachedOffline) return cachedOffline;
  }

  /**
   * 4. Dashboard.
   */
  if (isDashboardPath(pathname)) {
    const cachedDashboard = await getCachedPath('/dashboard');

    if (cachedDashboard) return cachedDashboard;

    const cachedAppShell = await getCachedPath('/offline-app.html');

    if (cachedAppShell) return cachedAppShell;

    const cachedOffline = await getCachedPath('/offline.html');

    if (cachedOffline) return cachedOffline;
  }

  /**
   * 5. Resto de rutas:
   * Usamos primero el shell offline, luego dashboard, luego pozos.
   */
  const fallbackOrder = [
    '/offline-app.html',
    '/dashboard',
    '/pozos',
    '/offline.html'
  ];

  for (const path of fallbackOrder) {
    const cached = await getCachedPath(path);

    if (cached) return cached;
  }

  /**
   * 6. Fallback embebido por si no existe ningún cache.
   */
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
  </style>
</head>
<body>
  <main>
    <h1>Sin conexión</h1>
    <p>No se encontró una versión cacheada de PetroField. Abre la app una vez con internet para preparar el modo offline.</p>
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
    return getOfflineFallback(request);
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
    cacheAppShell().then(() => self.skipWaiting())
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

  /**
   * API:
   * No se cachean respuestas dinámicas de API aquí.
   * Los datos persistentes viven en IndexedDB.
   */
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

  /**
   * Navegación:
   * Intenta red. Si falla, decide fallback según la ruta:
   * - /pozos/:id → offline-app.html
   * - /pozos → /pozos cacheado u offline-app.html
   * - /dashboard → /dashboard cacheado u offline-app.html
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  /**
   * Assets de la app:
   * Cache-first.
   */
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstAsset(event.request));
    return;
  }

  /**
   * Resto:
   * Cache-first con fallback al shell offline.
   */
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
          .catch(() => getOfflineFallback(event.request));
      })
  );
});