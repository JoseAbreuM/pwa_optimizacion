(() => {
  if (window.PetroOfflineStore) return;

  function getDB() {
    if (!window.PetroDB) {
      throw new Error('PetroDB no está disponible.');
    }

    return window.PetroDB;
  }

  async function getMetadata(key, fallbackValue = null) {
    try {
      const db = getDB();
      const value = await db.getMetadata(key);

      return value ?? fallbackValue;
    } catch (error) {
      console.warn('[OfflineStore] getMetadata:', error);
      return fallbackValue;
    }
  }

  async function getSnapshotInfo() {
    const [lastSnapshotAt, snapshotVersion, serverTime] = await Promise.all([
      getMetadata('lastSnapshotAt'),
      getMetadata('snapshotVersion'),
      getMetadata('serverTime')
    ]);

    return {
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      hasSnapshot: Boolean(lastSnapshotAt)
    };
  }

  async function hasSnapshot() {
    const info = await getSnapshotInfo();
    return info.hasSnapshot;
  }

  async function getDashboard() {
    try {
      const db = getDB();
      return await db.get('dashboard', 'main');
    } catch (error) {
      console.warn('[OfflineStore] getDashboard:', error);
      return null;
    }
  }

  async function getPozos() {
    try {
      const db = getDB();
      const pozos = await db.getAll('pozos');

      return pozos.sort((a, b) => {
        const codeA = String(a.codigo || '').toUpperCase();
        const codeB = String(b.codigo || '').toUpperCase();
        return codeA.localeCompare(codeB, 'es');
      });
    } catch (error) {
      console.warn('[OfflineStore] getPozos:', error);
      return [];
    }
  }

  async function getPozoDetalle(id) {
    try {
      const db = getDB();
      return await db.get('pozo_detalles', Number(id));
    } catch (error) {
      console.warn('[OfflineStore] getPozoDetalle:', error);
      return null;
    }
  }

  async function getParametrosByPozo(idPozo) {
    try {
      const db = getDB();
      const rows = await db.getAll('parametros');

      return rows
        .filter((row) => Number(row.id_pozo) === Number(idPozo))
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    } catch (error) {
      console.warn('[OfflineStore] getParametrosByPozo:', error);
      return [];
    }
  }

  async function getNivelesByPozo(idPozo) {
    try {
      const db = getDB();
      const rows = await db.getAll('niveles');

      return rows
        .filter((row) => Number(row.id_pozo) === Number(idPozo))
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    } catch (error) {
      console.warn('[OfflineStore] getNivelesByPozo:', error);
      return [];
    }
  }

  async function getBombasByPozo(idPozo) {
    try {
      const db = getDB();
      const rows = await db.getAll('bombas');

      return rows
        .filter((row) => Number(row.id_pozo) === Number(idPozo))
        .sort((a, b) => String(b.fecha_inst || '').localeCompare(String(a.fecha_inst || '')));
    } catch (error) {
      console.warn('[OfflineStore] getBombasByPozo:', error);
      return [];
    }
  }

  async function getPendingQueue() {
    try {
      const db = getDB();
      return await db.getPendingQueue();
    } catch (error) {
      console.warn('[OfflineStore] getPendingQueue:', error);
      return [];
    }
  }

  async function getResumen() {
    const [dashboard, pozos, info, queue] = await Promise.all([
      getDashboard(),
      getPozos(),
      getSnapshotInfo(),
      getPendingQueue()
    ]);

    const activos = pozos.filter((pozo) => {
      const estado = String(pozo.estado || pozo.estado_nombre || '').toLowerCase();
      return estado.includes('activo');
    }).length;

    return {
      dashboard,
      pozos,
      info,
      queue,
      totalPozos: pozos.length,
      activos,
      pendientesSync: queue.length
    };
  }

  window.PetroOfflineStore = {
    getMetadata,
    getSnapshotInfo,
    hasSnapshot,
    getDashboard,
    getPozos,
    getPozoDetalle,
    getParametrosByPozo,
    getNivelesByPozo,
    getBombasByPozo,
    getPendingQueue,
    getResumen
  };
})();