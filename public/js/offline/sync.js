(() => {
  if (window.PetroSync) return;

  const API_SNAPSHOT = '/api/offline/snapshot';
  const API_SYNC = '/api/offline/sync';

  const REQUIRED_STORES = [
    'dashboard',
    'pozos',
    'pozo_detalles',
    'parametros',
    'niveles',
    'muestras',
    'bombas',
    'servicios',
    'mapa_pozos',
    'survey'
  ];

  let initialized = false;
  let syncInProgress = false;
  let lastSyncError = null;

  function getDB() {
    return window.PetroDB || null;
  }

  function createLocalId() {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function emitStatus(detail = {}) {
    window.dispatchEvent(new CustomEvent('petro:offline-status', {
      detail: {
        online: navigator.onLine,
        syncInProgress,
        lastSyncError,
        ...detail
      }
    }));
  }

  function emitUpdated(detail = {}) {
    window.dispatchEvent(new CustomEvent('petro:offline-updated', {
      detail
    }));
  }

  function emitQueueUpdated(detail = {}) {
    window.dispatchEvent(new CustomEvent('petro:offline-queue-updated', {
      detail
    }));
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizePozoDetalles(value) {
    if (!value || typeof value !== 'object') return [];

    return Object.values(value)
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const pozo = item.pozo && typeof item.pozo === 'object' ? item.pozo : {};

        return {
          ...item,
          id: Number(item.id || pozo.id)
        };
      })
      .filter((item) => Number.isFinite(Number(item.id)));
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Snapshot vacío o inválido.');
    }

    const pozos = normalizeArray(snapshot.pozos);

    if (!pozos.length) {
      throw new Error('El snapshot no contiene pozos.');
    }

    return {
      dashboard: snapshot.dashboard || {},
      pozos,
      pozoDetalles: normalizePozoDetalles(snapshot.pozoDetalles),
      parametros: normalizeArray(snapshot.parametros),
      niveles: normalizeArray(snapshot.niveles),
      muestras: normalizeArray(snapshot.muestras),
      bombas: normalizeArray(snapshot.bombas),
      servicios: normalizeArray(snapshot.servicios),
      mapaPozos: normalizeArray(snapshot.mapaPozos),
      survey: normalizeArray(snapshot.survey),
      version: snapshot.version || new Date().toISOString(),
      serverTime: snapshot.serverTime || new Date().toISOString()
    };
  }

  function getSnapshotCounts(snapshot) {
    return {
      pozos: normalizeArray(snapshot?.pozos).length,
      pozoDetalles: normalizePozoDetalles(snapshot?.pozoDetalles).length,
      parametros: normalizeArray(snapshot?.parametros).length,
      niveles: normalizeArray(snapshot?.niveles).length,
      muestras: normalizeArray(snapshot?.muestras).length,
      bombas: normalizeArray(snapshot?.bombas).length,
      servicios: normalizeArray(snapshot?.servicios).length,
      mapaPozos: normalizeArray(snapshot?.mapaPozos).length,
      survey: normalizeArray(snapshot?.survey).length
    };
  }

  async function getPendingQueueCount() {
    const db = getDB();

    if (!db) return 0;

    try {
      const queue = await db.getPendingQueue();
      return queue.length;
    } catch (error) {
      return 0;
    }
  }

  async function getMetadataSnapshot() {
    const db = getDB();

    if (!db) {
      return {
        hasSnapshot: false,
        lastSnapshotAt: null,
        snapshotVersion: null,
        serverTime: null,
        counts: {}
      };
    }

    const [
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      counts
    ] = await Promise.all([
      db.getMetadata('lastSnapshotAt'),
      db.getMetadata('snapshotVersion'),
      db.getMetadata('serverTime'),
      db.getMetadata('snapshotCounts')
    ]);

    return {
      hasSnapshot: Boolean(lastSnapshotAt),
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      counts: counts || {}
    };
  }

  async function clearSnapshotStores() {
    const db = getDB();

    if (!db) return;

    for (const store of REQUIRED_STORES) {
      await db.clear(store);
    }
  }

  async function saveSnapshot(rawSnapshot = {}) {
    const db = getDB();

    if (!db) {
      throw new Error('IndexedDB no está disponible.');
    }

    const snapshot = validateSnapshot(rawSnapshot);
    const counts = getSnapshotCounts(snapshot);

    emitStatus({
      state: 'saving',
      message: 'Guardando datos offline...',
      counts
    });

    /**
     * Importante:
     * Solo limpiamos stores después de validar que el snapshot trae pozos.
     * Así evitamos borrar datos buenos por una respuesta inválida del servidor.
     */
    await clearSnapshotStores();

    await db.put('dashboard', {
      key: 'main',
      ...(snapshot.dashboard || {})
    });

    await db.putMany('pozos', snapshot.pozos);
    await db.putMany('pozo_detalles', snapshot.pozoDetalles);
    await db.putMany('parametros', snapshot.parametros);
    await db.putMany('niveles', snapshot.niveles);
    await db.putMany('muestras', snapshot.muestras);
    await db.putMany('bombas', snapshot.bombas);
    await db.putMany('servicios', snapshot.servicios);
    await db.putMany('mapa_pozos', snapshot.mapaPozos);
    await db.putMany('survey', snapshot.survey);

    await db.setMetadata('lastSnapshotAt', new Date().toISOString());
    await db.setMetadata('snapshotVersion', snapshot.version);
    await db.setMetadata('serverTime', snapshot.serverTime);
    await db.setMetadata('snapshotCounts', counts);

    emitUpdated({
      counts,
      version: snapshot.version,
      serverTime: snapshot.serverTime
    });

    return {
      snapshot,
      counts
    };
  }

  async function loadSnapshot(options = {}) {
    const db = getDB();

    if (!db) {
      lastSyncError = 'IndexedDB no está disponible.';
      emitStatus({
        state: 'error',
        message: lastSyncError
      });
      return null;
    }

    if (!navigator.onLine && !options.force) {
      emitStatus({
        state: 'offline',
        message: 'Sin conexión. Se usarán datos locales.'
      });
      return null;
    }

    if (syncInProgress) {
      emitStatus({
        state: 'busy',
        message: 'Sincronización offline ya está en proceso.'
      });
      return null;
    }

    syncInProgress = true;
    lastSyncError = null;

    emitStatus({
      state: 'loading',
      message: 'Descargando snapshot offline...'
    });

    try {
      const response = await fetch(API_SNAPSHOT, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        throw new Error(`No se pudo cargar snapshot. HTTP ${response.status}`);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('El snapshot no devolvió JSON. Probablemente la sesión expiró.');
      }

      const payload = await response.json();

      if (!payload.ok) {
        throw new Error(payload.message || 'Snapshot inválido.');
      }

      const result = await saveSnapshot(payload.snapshot);

      emitStatus({
        state: 'ready',
        message: 'Modo offline listo.',
        counts: result.counts
      });

      return result.snapshot;
    } catch (error) {
      lastSyncError = error.message || 'No se pudo preparar el modo offline.';

      console.warn('PetroSync.loadSnapshot:', error);

      emitStatus({
        state: 'error',
        message: lastSyncError
      });

      return null;
    } finally {
      syncInProgress = false;
    }
  }

  async function flushQueue() {
    const db = getDB();

    if (!db || !navigator.onLine) return [];

    const pendingQueue = await db.getPendingQueue();

    if (!pendingQueue.length) {
      emitQueueUpdated({
        queueLength: 0
      });
      return [];
    }

    emitStatus({
      state: 'syncing-queue',
      message: `Sincronizando ${pendingQueue.length} cambio(s) pendiente(s)...`
    });

    try {
      const response = await fetch(API_SYNC, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          operations: pendingQueue.map((item) => ({
            ...item,
            id: undefined,
            localId: item.localId || item.id
          }))
        })
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        throw new Error(`No se pudo sincronizar la cola. HTTP ${response.status}`);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('La sincronización no devolvió JSON.');
      }

      const payload = await response.json();

      if (!payload.ok || !Array.isArray(payload.results)) {
        throw new Error(payload.message || 'Respuesta de sincronización inválida.');
      }

      for (const result of payload.results) {
        const queueEntry = pendingQueue.find((entry) => (
          entry.localId === result.localId ||
          entry.id === result.localId
        ));

        if (result.ok && queueEntry) {
          await db.removeQueueOperation(queueEntry.id);
        }
      }

      const queueLength = await getPendingQueueCount();

      emitQueueUpdated({
        queueLength,
        results: payload.results
      });

      return payload.results;
    } catch (error) {
      console.warn('PetroSync.flushQueue:', error);

      lastSyncError = error.message || 'No se pudo sincronizar la cola.';

      emitStatus({
        state: 'error',
        message: lastSyncError
      });

      return [];
    }
  }

  async function syncNow(options = {}) {
    const db = getDB();

    if (!db) {
      lastSyncError = 'IndexedDB no está disponible.';
      emitStatus({
        state: 'error',
        message: lastSyncError
      });
      return null;
    }

    if (!navigator.onLine && !options.force) {
      emitStatus({
        state: 'offline',
        message: 'Sin conexión. Trabajando con datos locales.'
      });
      return null;
    }

    await flushQueue();

    return loadSnapshot(options);
  }

  async function enqueueOperation(operation) {
    const db = getDB();

    if (!db) {
      throw new Error('IndexedDB no disponible para encolar operación.');
    }

    const payload = {
      ...operation,
      localId: operation.localId || createLocalId(),
      createdAt: operation.createdAt || new Date().toISOString(),
      status: 'pending'
    };

    await db.addQueueOperation(payload);

    const queueLength = await getPendingQueueCount();

    emitQueueUpdated({
      queueLength
    });

    emitStatus({
      state: 'queued',
      message: `Cambio guardado localmente. Pendientes: ${queueLength}`,
      queueLength
    });

    return payload;
  }

  async function getOnlineStatus() {
    const queueLength = await getPendingQueueCount();
    const snapshot = await getMetadataSnapshot();

    return {
      online: navigator.onLine,
      syncInProgress,
      queueLength,
      lastSyncError,
      ...snapshot
    };
  }

  async function getDiagnostics() {
    const db = getDB();

    if (!db) {
      return {
        ok: false,
        message: 'PetroDB no está disponible.'
      };
    }

    const [
      metadata,
      dashboard,
      pozos,
      detalles,
      parametros,
      niveles,
      muestras,
      bombas,
      servicios,
      mapaPozos,
      survey,
      queue
    ] = await Promise.all([
      getMetadataSnapshot(),
      db.get('dashboard', 'main'),
      db.getAll('pozos'),
      db.getAll('pozo_detalles'),
      db.getAll('parametros'),
      db.getAll('niveles'),
      db.getAll('muestras'),
      db.getAll('bombas'),
      db.getAll('servicios'),
      db.getAll('mapa_pozos'),
      db.getAll('survey'),
      db.getPendingQueue()
    ]);

    return {
      ok: true,
      online: navigator.onLine,
      metadata,
      counts: {
        dashboard: dashboard ? 1 : 0,
        pozos: pozos.length,
        pozo_detalles: detalles.length,
        parametros: parametros.length,
        niveles: niveles.length,
        muestras: muestras.length,
        bombas: bombas.length,
        servicios: servicios.length,
        mapa_pozos: mapaPozos.length,
        survey: survey.length,
        queue: queue.length
      }
    };
  }

  async function init() {
    if (initialized) return;

    initialized = true;

    const db = getDB();

    if (!db) {
      lastSyncError = 'PetroDB no está inicializado.';
      emitStatus({
        state: 'error',
        message: lastSyncError
      });
      return;
    }

    emitStatus({
      state: navigator.onLine ? 'idle-online' : 'offline',
      message: navigator.onLine
        ? 'Con conexión. Preparando datos offline...'
        : 'Sin conexión. Trabajando con datos locales.'
    });

    window.addEventListener('online', () => {
      emitStatus({
        state: 'online',
        message: 'Conexión recuperada. Sincronizando...'
      });

      syncNow().catch(() => {});
    });

    window.addEventListener('offline', () => {
      emitStatus({
        state: 'offline',
        message: 'Sin conexión. Los cambios se guardarán localmente.'
      });
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow().catch(() => {});
      }
    });

    /**
     * Sincronización inicial.
     * Se ejecuta después del login porque este script vive dentro del layout autenticado.
     */
    if (navigator.onLine) {
      await syncNow();
    }
  }

  window.PetroSync = {
    init,
    loadSnapshot,
    saveSnapshot,
    flushQueue,
    syncNow,
    enqueueOperation,
    getOnlineStatus,
    getDiagnostics
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.PetroSync.init().catch(() => {});
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      window.PetroSync.init().catch(() => {});
    });
  }
})();