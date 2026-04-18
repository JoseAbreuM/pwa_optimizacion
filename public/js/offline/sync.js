(() => {
  let initialized = false;

  async function refreshKpis() {
    if (!window.PetroOfflineStore) return;

    const bootstrap = await window.PetroOfflineStore.getBootstrap();
    const queue = await window.PetroOfflineStore.getQueue();

    const kpiPozos = document.querySelector('[data-kpi="pozos"]');
    const kpiBombas = document.querySelector('[data-kpi="bombas"]');
    const kpiParametros = document.querySelector('[data-kpi="parametros"]');
    const kpiQueue = document.querySelector('[data-kpi="queue"]');

    if (kpiPozos) kpiPozos.textContent = String(bootstrap?.pozos?.length || 0);
    if (kpiBombas) kpiBombas.textContent = String(bootstrap?.bombas?.length || 0);
    if (kpiParametros) kpiParametros.textContent = String(bootstrap?.parametrosDiarios?.length || 0);
    if (kpiQueue) kpiQueue.textContent = String(queue.length);
  }

  async function loadBootstrap() {
    if (!window.PetroOfflineStore) return;

    try {
      const response = await fetch('/api/bootstrap', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) throw new Error('bootstrap fetch failed');
      const data = await response.json();
      await window.PetroOfflineStore.saveBootstrap(data);
    } catch (error) {
      // Mantenemos el último snapshot offline disponible.
    }

    await refreshKpis();
  }

  async function flushQueue() {
    if (!navigator.onLine || !window.PetroOfflineStore) return;

    const queue = await window.PetroOfflineStore.getQueue();

    for (const item of queue) {
      try {
        const response = await fetch('/api/sync/operation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item)
        });

        if (response.ok) {
          await window.PetroOfflineStore.clearQueueItem(item.id);
        }
      } catch (error) {
        break;
      }
    }

    await refreshKpis();
  }

  async function initDashboard() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('online', flushQueue);
    await loadBootstrap();
    await flushQueue();
  }

  window.PetroSync = {
    initDashboard,
    refreshKpis,
    loadBootstrap,
    flushQueue
  };
})();
