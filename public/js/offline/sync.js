(() => {
  if (window.PetroSync) return;

  const db = window.PetroDB;
  const API_SNAPSHOT = '/api/offline/snapshot';
  const API_SYNC = '/api/offline/sync';

  function createLocalId() {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function loadSnapshot() {
    if (!db) {
      console.warn('PetroSync: IndexedDB no disponible.');
      return null;
    }

    try {
      const response = await fetch(API_SNAPSHOT, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar snapshot.');
      }

      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message || 'Snapshot inválido.');
      }

      await saveSnapshot(payload.snapshot);
      return payload.snapshot;
    } catch (error) {
      console.warn('PetroSync.loadSnapshot:', error.message || error);
      return null;
    }
  }

  async function saveSnapshot(snapshot = {}) {
    if (!db || !snapshot) return;

    await Promise.all([
      db.put('dashboard', { key: 'main', ...snapshot.dashboard }),
      db.putMany('pozos', Array.isArray(snapshot.pozos) ? snapshot.pozos : []),
      db.putMany('pozo_detalles', snapshot.pozoDetalles && typeof snapshot.pozoDetalles === 'object'
        ? Object.values(snapshot.pozoDetalles)
        : []),
      db.putMany('parametros', Array.isArray(snapshot.parametros) ? snapshot.parametros : []),
      db.putMany('niveles', Array.isArray(snapshot.niveles) ? snapshot.niveles : []),
      db.putMany('muestras', Array.isArray(snapshot.muestras) ? snapshot.muestras : []),
      db.putMany('bombas', Array.isArray(snapshot.bombas) ? snapshot.bombas : []),
      db.putMany('servicios', Array.isArray(snapshot.servicios) ? snapshot.servicios : []),
      db.putMany('mapa_pozos', Array.isArray(snapshot.mapaPozos) ? snapshot.mapaPozos : []),
      db.putMany('survey', Array.isArray(snapshot.survey) ? snapshot.survey : [])
    ]);

    await Promise.all([
      db.setMetadata('lastSnapshotAt', new Date().toISOString()),
      db.setMetadata('snapshotVersion', snapshot.version || new Date().toISOString()),
      db.setMetadata('serverTime', snapshot.serverTime || new Date().toISOString())
    ]);
  }

  async function flushQueue() {
    if (!db || !navigator.onLine) return [];

    const pendingQueue = await db.getPendingQueue();
    if (!pendingQueue.length) return [];

    try {
      const response = await fetch(API_SYNC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operations: pendingQueue.map((item) => ({
          ...item,
          id: undefined,
          localId: item.localId || item.id
        })) })
      });

      if (!response.ok) {
        throw new Error('No se pudo sincronizar la cola.');
      }

      const payload = await response.json();
      if (!payload.ok || !Array.isArray(payload.results)) {
        throw new Error(payload.message || 'Respuesta de sincronización inválida.');
      }

      for (const result of payload.results) {
        const queueEntry = pendingQueue.find((entry) => entry.localId === result.localId || entry.id === result.localId);
        if (result.ok && queueEntry) {
          await db.removeQueueOperation(queueEntry.id);
        }
      }

      window.dispatchEvent(new CustomEvent('petro:offline-queue-updated'));
      return payload.results;
    } catch (error) {
      console.warn('PetroSync.flushQueue:', error.message || error);
      return [];
    }
  }

  async function syncNow() {
    if (!db || !navigator.onLine) return;

    await flushQueue();
    await loadSnapshot();
    window.dispatchEvent(new Event('petro:offline-updated'));
  }

  async function enqueueOperation(operation) {
    if (!db) {
      console.warn('PetroSync: IndexedDB no disponible para encolar operación.');
      return null;
    }

    const payload = {
      ...operation,
      localId: operation.localId || createLocalId(),
      createdAt: operation.createdAt || new Date().toISOString(),
      status: 'pending'
    };

    await db.addQueueOperation(payload);
    window.dispatchEvent(new CustomEvent('petro:offline-queue-updated'));
    return payload;
  }

  async function getOnlineStatus() {
    if (!db) {
      return { online: navigator.onLine, queueLength: 0 };
    }

    const queue = await db.getPendingQueue();
    return {
      online: navigator.onLine,
      queueLength: queue.length
    };
  }

  async function init() {
    if (!db) {
      console.warn('PetroSync: window.PetroDB no está inicializado.');
      return;
    }

    window.addEventListener('online', () => {
      syncNow().catch(() => {});
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow().catch(() => {});
      }
    });

    if (navigator.onLine) {
      await syncNow();
    }
  }

  window.PetroSync = {
    loadSnapshot,
    saveSnapshot,
    flushQueue,
    syncNow,
    enqueueOperation,
    getOnlineStatus,
    init
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.PetroSync.init().catch(() => {});
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      window.PetroSync.init().catch(() => {});
    });
  }
})();
