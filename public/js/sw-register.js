(() => {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service worker registrado:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({
              type: 'SKIP_WAITING'
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;

        refreshing = true;
        console.log('[PWA] Nuevo service worker activo.');
      });

      if (registration.waiting) {
        registration.waiting.postMessage({
          type: 'SKIP_WAITING'
        });
      }

      await registration.update();
    } catch (error) {
      console.error('[PWA] No se pudo registrar SW:', error);
    }
  }

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }
})();