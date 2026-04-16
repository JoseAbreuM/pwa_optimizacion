async function refreshKpis() {
  const bootstrap = await window.PetroOfflineStore.getBootstrap();
  const queue = await window.PetroOfflineStore.getQueue();

  const kpiPozos = document.querySelector('[data-kpi="pozos"]');
  const kpiBombas = document.querySelector('[data-kpi="bombas"]');
  const kpiParametros = document.querySelector('[data-kpi="parametros"]');
  const kpiQueue = document.querySelector('[data-kpi="queue"]');

  if (!kpiPozos || !kpiBombas || !kpiParametros || !kpiQueue) return;

  kpiPozos.textContent = String(bootstrap?.pozos?.length || 0);
  kpiBombas.textContent = String(bootstrap?.bombas?.length || 0);
  kpiParametros.textContent = String(bootstrap?.parametrosDiarios?.length || 0);
  kpiQueue.textContent = String(queue.length);
}

async function loadBootstrap() {
  try {
    const response = await fetch('/api/bootstrap');
    if (!response.ok) throw new Error('bootstrap fetch failed');
    const data = await response.json();
    await window.PetroOfflineStore.saveBootstrap(data);
    await refreshKpis();
  } catch (error) {
    await refreshKpis();
  }
}

async function flushQueue() {
  if (!navigator.onLine) return;

  const queue = await window.PetroOfflineStore.getQueue();
  for (const item of queue) {
    try {
      const response = await fetch('/api/sync/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

window.addEventListener('online', flushQueue);
document.addEventListener('DOMContentLoaded', async () => {
  await loadBootstrap();
  await flushQueue();
});
