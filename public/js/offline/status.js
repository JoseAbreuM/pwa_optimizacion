(() => {
  if (window.PetroOfflineStatus) return;

  const STATUS_ID = 'petro-offline-status';
  const STATUS_TEXT = {
    online: 'Online',
    offline: 'Offline',
    syncing: 'Sincronizando',
    pending: 'Cambios pendientes'
  };

  function createStatusElement() {
    let badge = document.getElementById(STATUS_ID);
    if (badge) return badge;

    badge = document.createElement('div');
    badge.id = STATUS_ID;
    badge.style.position = 'fixed';
    badge.style.right = '1rem';
    badge.style.bottom = '1rem';
    badge.style.zIndex = '9999';
    badge.style.padding = '0.65rem 0.9rem';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '0.85rem';
    badge.style.fontWeight = '600';
    badge.style.boxShadow = '0 10px 25px rgba(15, 23, 42, 0.2)';
    badge.style.backdropFilter = 'blur(10px)';
    badge.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    badge.style.opacity = '0.96';
    badge.style.maxWidth = 'calc(100vw - 2rem)';
    badge.style.whiteSpace = 'nowrap';
    document.body.appendChild(badge);

    return badge;
  }

  function renderStatus(status, detail = '') {
    const badge = createStatusElement();
    const text = detail ? `${STATUS_TEXT[status] || status} · ${detail}` : STATUS_TEXT[status] || status;
    badge.textContent = text;

    badge.style.backgroundColor = status === 'offline'
      ? '#e11d48'
      : status === 'syncing'
      ? '#2563eb'
      : '#16a34a';
    badge.style.color = '#ffffff';
  }

  async function refreshStatus() {
    if (!window.PetroSync || typeof window.PetroSync.getOnlineStatus !== 'function') {
      renderStatus(navigator.onLine ? 'online' : 'offline');
      return;
    }

    const status = navigator.onLine ? 'online' : 'offline';
    const { queueLength } = await window.PetroSync.getOnlineStatus();
    const detail = queueLength > 0 ? `${queueLength} pendientes` : '';
    renderStatus(status, detail);
  }

  function handleOnline() {
    renderStatus('syncing');
    refreshStatus();
  }

  function handleOffline() {
    renderStatus('offline');
  }

  function handleUpdated() {
    renderStatus('online');
    refreshStatus();
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('petro:offline-updated', handleUpdated);
  window.addEventListener('petro:offline-queue-updated', refreshStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshStatus();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    refreshStatus();
  } else {
    document.addEventListener('DOMContentLoaded', refreshStatus);
  }

  window.PetroOfflineStatus = {
    refreshStatus
  };
})();
