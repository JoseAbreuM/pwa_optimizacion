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
  let lastSyncStartedAt = 0;

  function getDB() {
    return window.PetroDB || null;
  }

  function createLocalId() {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isNetworkError(error) {
    const message = String(error?.message || error || '');

    return (
      error instanceof TypeError ||
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('ERR_INTERNET_DISCONNECTED') ||
      message.includes('Load failed')
    );
  }

  function emitStatus(detail = {}) {
    const payload = {
      online: navigator.onLine,
      syncInProgress,
      lastSyncError,
      timestamp: new Date().toISOString(),
      ...detail
    };

    window.dispatchEvent(new CustomEvent('petro:offline-status', {
      detail: payload
    }));

    try {
      localStorage.setItem('petro-offline-last-status', JSON.stringify(payload));
    } catch (error) {
      // No bloquear si localStorage falla.
    }
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

  function hasUsefulCounts(counts = {}) {
    return Number(counts.pozos || 0) > 0;
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
      hasSnapshot: Boolean(lastSnapshotAt) && hasUsefulCounts(counts || {}),
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      counts: counts || {}
    };
  }

  async function emitOfflineStatus(message = null) {
    const metadata = await getMetadataSnapshot();

    lastSyncError = null;

    emitStatus({
      state: 'offline',
      message: message || (
        metadata.hasSnapshot
          ? 'Sin conexión. Usando datos locales guardados.'
          : 'Sin conexión. Aún no hay datos offline guardados.'
      ),
      progress: metadata.hasSnapshot ? 100 : 0,
      counts: metadata.counts
    });

    return null;
  }

  async function clearSnapshotStores(counts = {}) {
    const db = getDB();

    if (!db) return;

    emitStatus({
      state: 'saving',
      message: 'Limpiando almacenamiento local anterior...',
      progress: 15,
      counts
    });

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

    const steps = [
      {
        label: 'Dashboard',
        progress: 20,
        countKey: 'dashboard',
        run: async () => {
          await db.put('dashboard', {
            key: 'main',
            ...(snapshot.dashboard || {})
          });
        }
      },
      {
        label: 'Pozos',
        progress: 30,
        countKey: 'pozos',
        run: async () => db.putMany('pozos', snapshot.pozos)
      },
      {
        label: 'Fichas de pozos',
        progress: 40,
        countKey: 'pozoDetalles',
        run: async () => db.putMany('pozo_detalles', snapshot.pozoDetalles)
      },
      {
        label: 'Parámetros',
        progress: 52,
        countKey: 'parametros',
        run: async () => db.putMany('parametros', snapshot.parametros)
      },
      {
        label: 'Niveles',
        progress: 64,
        countKey: 'niveles',
        run: async () => db.putMany('niveles', snapshot.niveles)
      },
      {
        label: 'Muestras',
        progress: 74,
        countKey: 'muestras',
        run: async () => db.putMany('muestras', snapshot.muestras)
      },
      {
        label: 'Bombas',
        progress: 84,
        countKey: 'bombas',
        run: async () => db.putMany('bombas', snapshot.bombas)
      },
      {
        label: 'Servicios',
        progress: 90,
        countKey: 'servicios',
        run: async () => db.putMany('servicios', snapshot.servicios)
      },
      {
        label: 'Mapa',
        progress: 95,
        countKey: 'mapaPozos',
        run: async () => db.putMany('mapa_pozos', snapshot.mapaPozos)
      },
      {
        label: 'Survey',
        progress: 98,
        countKey: 'survey',
        run: async () => db.putMany('survey', snapshot.survey)
      }
    ];

    emitStatus({
      state: 'saving',
      message: 'Validando snapshot offline...',
      progress: 12,
      counts
    });

    await clearSnapshotStores(counts);

    for (const step of steps) {
      const stepCount = counts[step.countKey];

      emitStatus({
        state: 'saving',
        message: typeof stepCount === 'number'
          ? `Guardando ${step.label} (${stepCount})...`
          : `Guardando ${step.label}...`,
        progress: step.progress,
        counts
      });

      await step.run();
    }

    emitStatus({
      state: 'saving',
      message: 'Guardando metadatos offline...',
      progress: 99,
      counts
    });

    await db.setMetadata('lastSnapshotAt', new Date().toISOString());
    await db.setMetadata('snapshotVersion', snapshot.version);
    await db.setMetadata('serverTime', snapshot.serverTime);
    await db.setMetadata('snapshotCounts', counts);

    try {
      localStorage.setItem('petro-offline-ready', '1');
      localStorage.setItem('petro-offline-ready-at', new Date().toISOString());
    } catch (error) {
      // No bloquear si localStorage falla.
    }

    emitStatus({
      state: 'ready',
      message: 'Datos offline guardados correctamente.',
      progress: 100,
      counts
    });

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
        message: lastSyncError,
        progress: 0
      });

      return null;
    }

    if (!navigator.onLine && !options.force) {
      return emitOfflineStatus();
    }

    if (syncInProgress) {
      emitStatus({
        state: 'busy',
        message: 'Sincronización offline ya está en proceso.',
        progress: 8
      });

      return null;
    }

    syncInProgress = true;
    lastSyncError = null;
    lastSyncStartedAt = Date.now();

    emitStatus({
      state: 'loading',
      message: 'Descargando snapshot offline...',
      progress: 8
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

      /**
       * Si devuelve HTML, casi siempre es /login por sesión expirada.
       * Si ya hay datos locales, no rompemos la experiencia offline.
       */
      if (!contentType.includes('application/json')) {
        const metadata = await getMetadataSnapshot();

        if (metadata.hasSnapshot) {
          lastSyncError = null;

          emitStatus({
            state: 'offline',
            message: 'Sesión online expirada. Usando datos locales guardados.',
            progress: 100,
            counts: metadata.counts
          });

          return null;
        }

        lastSyncError = 'La sesión expiró y aún no hay datos offline guardados.';

        emitStatus({
          state: 'error',
          message: lastSyncError,
          progress: 0
        });

        return null;
      }

      emitStatus({
        state: 'loading',
        message: 'Snapshot recibido. Leyendo respuesta...',
        progress: 10
      });

      const payload = await response.json();

      if (!payload.ok) {
        throw new Error(payload.message || 'Snapshot inválido.');
      }

      emitStatus({
        state: 'saving',
        message: 'Snapshot descargado. Preparando almacenamiento local...',
        progress: 11
      });

      const result = await saveSnapshot(payload.snapshot);

      emitStatus({
        state: 'ready',
        message: 'Modo offline listo.',
        progress: 100,
        counts: result.counts
      });

      return result.snapshot;
    } catch (error) {
      if (isNetworkError(error)) {
        return emitOfflineStatus();
      }

      lastSyncError = error.message || 'No se pudo preparar el modo offline.';

      console.warn('PetroSync.loadSnapshot:', error);

      emitStatus({
        state: 'error',
        message: lastSyncError,
        progress: 0
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
      message: `Sincronizando ${pendingQueue.length} cambio(s) pendiente(s)...`,
      progress: 8,
      queueLength: pendingQueue.length
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
        const metadata = await getMetadataSnapshot();

        emitStatus({
          state: metadata.hasSnapshot ? 'offline' : 'error',
          message: metadata.hasSnapshot
            ? 'No se pudo sincronizar la cola. Usando datos locales.'
            : 'No se pudo sincronizar la cola y no hay snapshot local.',
          progress: metadata.hasSnapshot ? 100 : 0,
          counts: metadata.counts
        });

        return [];
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

      emitStatus({
        state: 'syncing-queue',
        message: queueLength
          ? `Quedan ${queueLength} cambio(s) pendiente(s).`
          : 'Cambios pendientes sincronizados.',
        progress: queueLength ? 50 : 100,
        queueLength
      });

      return payload.results;
    } catch (error) {
      if (isNetworkError(error)) {
        return [];
      }

      console.warn('PetroSync.flushQueue:', error);

      lastSyncError = error.message || 'No se pudo sincronizar la cola.';

      emitStatus({
        state: 'error',
        message: lastSyncError,
        progress: 0
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
        message: lastSyncError,
        progress: 0
      });

      return null;
    }

    if (!navigator.onLine && !options.force) {
      return emitOfflineStatus('Sin conexión. Trabajando con datos locales.');
    }

    /**
     * Evita loops agresivos cuando el navegador dice online,
     * pero realmente no hay internet o Render no responde.
     */
    if (!options.force && lastSyncStartedAt && Date.now() - lastSyncStartedAt < 8000) {
      emitStatus({
        state: 'busy',
        message: 'Sincronización reciente en proceso o recién ejecutada.',
        progress: 8
      });

      return null;
    }

    emitStatus({
      state: 'loading',
      message: 'Preparando sincronización offline...',
      progress: 5
    });

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
      progress: 100,
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
      syncInProgress,
      lastSyncError,
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
        message: lastSyncError,
        progress: 0
      });

      return;
    }

    const metadata = await getMetadataSnapshot();

    emitStatus({
      state: navigator.onLine ? 'idle-online' : 'offline',
      message: navigator.onLine
        ? (
          metadata.hasSnapshot
            ? 'Con conexión. Verificando actualización offline...'
            : 'Con conexión. Preparando datos offline por primera vez...'
        )
        : (
          metadata.hasSnapshot
            ? 'Sin conexión. Trabajando con datos locales.'
            : 'Sin conexión. No hay datos offline guardados.'
        ),
      progress: metadata.hasSnapshot ? 100 : 5,
      counts: metadata.counts
    });

    window.addEventListener('online', () => {
      emitStatus({
        state: 'online',
        message: 'Conexión recuperada. Sincronizando...',
        progress: 8
      });

      syncNow().catch(() => {});
    });

    window.addEventListener('offline', async () => {
      await emitOfflineStatus('Sin conexión. Los cambios se guardarán localmente.');
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
    } else {
      await emitOfflineStatus();
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
    window.PetroSync.init().catch((error) => {
      console.warn('PetroSync.init:', error);
    });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      window.PetroSync.init().catch((error) => {
        console.warn('PetroSync.init:', error);
      });
    });
  }
})();