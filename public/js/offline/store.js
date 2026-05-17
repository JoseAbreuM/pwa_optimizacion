(() => {
  if (window.PetroOfflineStore) return;

  function getDB() {
    if (!window.PetroDB) {
      throw new Error('PetroDB no está disponible.');
    }

    return window.PetroDB;
  }

  function normalizeId(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function sortByCodigo(a, b) {
    const codeA = String(a.codigo || '').toUpperCase();
    const codeB = String(b.codigo || '').toUpperCase();

    return codeA.localeCompare(codeB, 'es');
  }

  function sortByFechaDesc(fieldName = 'fecha') {
    return (a, b) => {
      const dateA = String(a?.[fieldName] || '');
      const dateB = String(b?.[fieldName] || '');

      return dateB.localeCompare(dateA);
    };
  }

  function getPozoId(row) {
    return Number(
      row?.id_pozo ??
      row?.pozo_id ??
      row?.idPozo ??
      row?.id
    );
  }

  async function safeGetAll(storeName) {
    try {
      const db = getDB();
      return await db.getAll(storeName);
    } catch (error) {
      console.warn(`[OfflineStore] No se pudo leer ${storeName}:`, error);
      return [];
    }
  }

  async function safeGet(storeName, key, fallbackValue = null) {
    try {
      const db = getDB();
      const value = await db.get(storeName, key);

      return value ?? fallbackValue;
    } catch (error) {
      console.warn(`[OfflineStore] No se pudo leer ${storeName}:`, error);
      return fallbackValue;
    }
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
    const [
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      snapshotCounts
    ] = await Promise.all([
      getMetadata('lastSnapshotAt'),
      getMetadata('snapshotVersion'),
      getMetadata('serverTime'),
      getMetadata('snapshotCounts', {})
    ]);

    return {
      lastSnapshotAt,
      snapshotVersion,
      serverTime,
      counts: snapshotCounts || {},
      hasSnapshot: Boolean(lastSnapshotAt)
    };
  }

  async function hasSnapshot() {
    const info = await getSnapshotInfo();
    return info.hasSnapshot;
  }

  async function getDashboard() {
    return safeGet('dashboard', 'main', null);
  }

  async function getPozos() {
    const pozos = await safeGetAll('pozos');

    return pozos.sort(sortByCodigo);
  }

  async function findPozos(query = '', filters = {}) {
    const pozos = await getPozos();
    const cleanQuery = normalizeText(query);

    return pozos.filter((pozo) => {
      const matchesQuery = !cleanQuery || normalizeText([
        pozo.codigo,
        pozo.area,
        pozo.estado,
        pozo.estado_nombre,
        pozo.categoria,
        pozo.yacimiento,
        pozo.metodo_levantamiento,
        pozo.cabezal,
        pozo.variador
      ].join(' ')).includes(cleanQuery);

      const matchesArea = !filters.area || normalizeText(pozo.area) === normalizeText(filters.area);
      const matchesEstado = !filters.estado || normalizeText(pozo.estado || pozo.estado_nombre) === normalizeText(filters.estado);
      const matchesCategoria = !filters.categoria || String(pozo.categoria || '') === String(filters.categoria);

      return matchesQuery && matchesArea && matchesEstado && matchesCategoria;
    });
  }

  async function getPozoDetalle(id) {
    const numericId = normalizeId(id);

    const detalle = await safeGet('pozo_detalles', numericId, null);

    if (detalle) return detalle;

    const pozos = await getPozos();
    const pozo = pozos.find((item) => Number(item.id) === Number(id));

    if (!pozo) return null;

    return {
      id: pozo.id,
      pozo
    };
  }

  async function getParametros() {
    return safeGetAll('parametros');
  }

  async function getNiveles() {
    return safeGetAll('niveles');
  }

  async function getMuestras() {
    return safeGetAll('muestras');
  }

  async function getBombas() {
    return safeGetAll('bombas');
  }

  async function getServicios() {
    return safeGetAll('servicios');
  }

  async function getMapaPozos() {
    return safeGetAll('mapa_pozos');
  }

  async function getSurvey() {
    return safeGetAll('survey');
  }

  async function getParametrosByPozo(idPozo) {
    const rows = await getParametros();

    return rows
      .filter((row) => getPozoId(row) === Number(idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getNivelesByPozo(idPozo) {
    const rows = await getNiveles();

    return rows
      .filter((row) => getPozoId(row) === Number(idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getMuestrasByPozo(idPozo) {
    const rows = await getMuestras();

    return rows
      .filter((row) => getPozoId(row) === Number(idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getBombasByPozo(idPozo) {
    const rows = await getBombas();

    return rows
      .filter((row) => getPozoId(row) === Number(idPozo))
      .sort(sortByFechaDesc('fecha_inst'));
  }

  async function getSurveyByPozo(idPozo) {
    const rows = await getSurvey();

    return rows
      .filter((row) => getPozoId(row) === Number(idPozo))
      .sort((a, b) => {
        const orderA = Number(a.fila_orden ?? a.orden ?? 0);
        const orderB = Number(b.fila_orden ?? b.orden ?? 0);

        return orderA - orderB;
      });
  }

  async function getMapaPozo(idPozo) {
    const rows = await getMapaPozos();

    return rows.find((row) => Number(row.id) === Number(idPozo) || Number(row.id_pozo) === Number(idPozo)) || null;
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

  async function getPozoFull(idPozo) {
    const [
      detalle,
      parametros,
      niveles,
      muestras,
      bombas,
      survey,
      mapa
    ] = await Promise.all([
      getPozoDetalle(idPozo),
      getParametrosByPozo(idPozo),
      getNivelesByPozo(idPozo),
      getMuestrasByPozo(idPozo),
      getBombasByPozo(idPozo),
      getSurveyByPozo(idPozo),
      getMapaPozo(idPozo)
    ]);

    const pozo = detalle?.pozo || detalle || null;

    return {
      id: Number(idPozo),
      pozo,
      detalle,
      mapa,
      parametros,
      niveles,
      muestras,
      bombas,
      survey,
      ultimoParametro: parametros[0] || null,
      ultimoNivel: niveles[0] || null,
      bombaActual: bombas[0] || null
    };
  }

  async function getFilterOptions() {
    const pozos = await getPozos();

    const areas = [...new Set(
      pozos
        .map((pozo) => pozo.area)
        .filter(Boolean)
    )].sort((a, b) => String(a).localeCompare(String(b), 'es'));

    const estados = [...new Set(
      pozos
        .map((pozo) => pozo.estado || pozo.estado_nombre)
        .filter(Boolean)
    )].sort((a, b) => String(a).localeCompare(String(b), 'es'));

    const categorias = [...new Set(
      pozos
        .map((pozo) => pozo.categoria)
        .filter((value) => value !== null && value !== undefined && value !== '')
    )].sort((a, b) => Number(a) - Number(b));

    return {
      areas,
      estados,
      categorias
    };
  }

  async function getResumen() {
    const [
      dashboard,
      pozos,
      info,
      queue,
      parametros,
      niveles,
      bombas,
      muestras,
      servicios,
      mapaPozos,
      survey
    ] = await Promise.all([
      getDashboard(),
      getPozos(),
      getSnapshotInfo(),
      getPendingQueue(),
      getParametros(),
      getNiveles(),
      getBombas(),
      getMuestras(),
      getServicios(),
      getMapaPozos(),
      getSurvey()
    ]);

    const activos = pozos.filter((pozo) => {
      const estado = normalizeText(pozo.estado || pozo.estado_nombre);
      return estado === 'activo' || estado.includes('activo');
    }).length;

    return {
      dashboard,
      pozos,
      info,
      queue,
      totalPozos: pozos.length,
      activos,
      pendientesSync: queue.length,
      counts: {
        dashboard: dashboard ? 1 : 0,
        pozos: pozos.length,
        parametros: parametros.length,
        niveles: niveles.length,
        bombas: bombas.length,
        muestras: muestras.length,
        servicios: servicios.length,
        mapa_pozos: mapaPozos.length,
        survey: survey.length,
        queue: queue.length
      }
    };
  }

  async function getDiagnostics() {
    try {
      const resumen = await getResumen();

      return {
        ok: true,
        online: navigator.onLine,
        metadata: resumen.info,
        counts: resumen.counts
      };
    } catch (error) {
      return {
        ok: false,
        online: navigator.onLine,
        message: error.message || 'No se pudo leer IndexedDB.',
        error
      };
    }
  }

  window.PetroOfflineStore = {
    getMetadata,
    getSnapshotInfo,
    hasSnapshot,

    getDashboard,
    getPozos,
    findPozos,
    getPozoDetalle,
    getPozoFull,

    getParametros,
    getNiveles,
    getMuestras,
    getBombas,
    getServicios,
    getMapaPozos,
    getSurvey,

    getParametrosByPozo,
    getNivelesByPozo,
    getMuestrasByPozo,
    getBombasByPozo,
    getSurveyByPozo,
    getMapaPozo,

    getPendingQueue,
    getFilterOptions,
    getResumen,
    getDiagnostics
  };
})();