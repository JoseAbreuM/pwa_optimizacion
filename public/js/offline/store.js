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
    const id = Number(
      row?.id_pozo ??
      row?.pozo_id ??
      row?.idPozo
    );

    return Number.isFinite(id) ? id : null;
  }

  function getOwnId(row) {
    const id = Number(row?.id);
    return Number.isFinite(id) ? id : null;
  }

  function samePozo(row, idPozo) {
    const wanted = Number(idPozo);

    if (!Number.isFinite(wanted)) return false;

    const explicitPozoId = getPozoId(row);

    if (explicitPozoId) {
      return explicitPozoId === wanted;
    }

    /**
     * Para mapa_pozos algunos registros usan id como id_pozo.
     */
    const ownId = getOwnId(row);
    return ownId === wanted;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstValid(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    return null;
  }

  function normalizeDetalle(detalle = {}, idPozo = null) {
    const pozo = detalle.pozo && typeof detalle.pozo === 'object'
      ? detalle.pozo
      : null;

    const fallbackPozo = detalle.codigo || detalle.area || detalle.estado || detalle.estado_nombre
      ? detalle
      : null;

    const finalPozo = pozo || fallbackPozo || null;
    const finalId = Number(
      detalle.id ??
      finalPozo?.id ??
      idPozo
    );

    return {
      ...detalle,
      id: Number.isFinite(finalId) ? finalId : idPozo,
      pozo: finalPozo
    };
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
      hasSnapshot: Boolean(lastSnapshotAt) && Number(snapshotCounts?.pozos || 0) > 0
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
        pozo.estado_pozo,
        pozo.categoria,
        pozo.yacimiento,
        pozo.metodo_levantamiento,
        pozo.metodo,
        pozo.metodo_nombre,
        pozo.cabezal,
        pozo.variador
      ].join(' ')).includes(cleanQuery);

      const estadoPozo = pozo.estado || pozo.estado_nombre || pozo.estado_pozo;

      const matchesArea = !filters.area || normalizeText(pozo.area) === normalizeText(filters.area);
      const matchesEstado = !filters.estado || normalizeText(estadoPozo) === normalizeText(filters.estado);
      const matchesCategoria = !filters.categoria || String(pozo.categoria || '') === String(filters.categoria);

      return matchesQuery && matchesArea && matchesEstado && matchesCategoria;
    });
  }

  async function getPozoDetalle(id) {
    const numericId = normalizeId(id);

    /**
     * Camino principal:
     * pozo_detalles guardado por snapshot.
     */
    const detalle = await safeGet('pozo_detalles', numericId, null);

    if (detalle) {
      return normalizeDetalle(detalle, Number(id));
    }

    /**
     * Fallback:
     * reconstruir desde store pozos.
     */
    const pozos = await getPozos();
    const pozo = pozos.find((item) => Number(item.id) === Number(id));

    if (!pozo) return null;

    return {
      id: Number(pozo.id),
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
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getNivelesByPozo(idPozo) {
    const rows = await getNiveles();

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getMuestrasByPozo(idPozo) {
    const rows = await getMuestras();

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getBombasByPozo(idPozo) {
    const rows = await getBombas();

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha_inst'));
  }

  async function getSurveyByPozo(idPozo) {
    const rows = await getSurvey();

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort((a, b) => {
        const orderA = Number(a.fila_orden ?? a.orden ?? 0);
        const orderB = Number(b.fila_orden ?? b.orden ?? 0);

        return orderA - orderB;
      });
  }

  async function getMapaPozo(idPozo) {
    const rows = await getMapaPozos();

    return rows.find((row) => samePozo(row, idPozo)) || null;
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

  function mergeRows(primaryRows = [], fallbackRows = [], dateField = 'fecha') {
    const rows = ensureArray(primaryRows).length
      ? ensureArray(primaryRows)
      : ensureArray(fallbackRows);

    return rows.sort(sortByFechaDesc(dateField));
  }

  function getBombaActual(detalle, bombas) {
    return firstValid(
      detalle?.bombaActual,
      detalle?.bomba_actual,
      detalle?.bomba,
      ensureArray(bombas)[0]
    );
  }

  function getUltimoParametro(detalle, parametros) {
    return firstValid(
      detalle?.ultimoParametro,
      detalle?.ultimo_parametro,
      ensureArray(parametros)[0]
    );
  }

  function getUltimoNivel(detalle, niveles) {
    return firstValid(
      detalle?.ultimoNivel,
      detalle?.ultimo_nivel,
      ensureArray(niveles)[0]
    );
  }

  async function getPozoFull(idPozo) {
    const detalle = await getPozoDetalle(idPozo);

    const [
      parametrosFromStore,
      nivelesFromStore,
      muestrasFromStore,
      bombasFromStore,
      surveyFromStore,
      mapaFromStore
    ] = await Promise.all([
      getParametrosByPozo(idPozo),
      getNivelesByPozo(idPozo),
      getMuestrasByPozo(idPozo),
      getBombasByPozo(idPozo),
      getSurveyByPozo(idPozo),
      getMapaPozo(idPozo)
    ]);

    const normalizedDetalle = detalle ? normalizeDetalle(detalle, Number(idPozo)) : null;

    const pozo = normalizedDetalle?.pozo || null;

    const parametros = mergeRows(
      normalizedDetalle?.parametros,
      parametrosFromStore,
      'fecha'
    );

    const niveles = mergeRows(
      normalizedDetalle?.niveles,
      nivelesFromStore,
      'fecha'
    );

    const muestras = mergeRows(
      normalizedDetalle?.muestras,
      muestrasFromStore,
      'fecha'
    );

    const bombas = mergeRows(
      normalizedDetalle?.bombas,
      bombasFromStore,
      'fecha_inst'
    );

    const survey = ensureArray(normalizedDetalle?.survey).length
      ? ensureArray(normalizedDetalle.survey)
      : surveyFromStore;

    const mapa = normalizedDetalle?.mapa || mapaFromStore || null;

    const ultimoParametro = getUltimoParametro(normalizedDetalle, parametros);
    const ultimoNivel = getUltimoNivel(normalizedDetalle, niveles);
    const bombaActual = getBombaActual(normalizedDetalle, bombas);

    return {
      id: Number(idPozo),
      pozo,
      detalle: normalizedDetalle,
      mapa,

      parametros,
      niveles,
      muestras,
      bombas,
      survey,

      ultimoParametro,
      ultimoNivel,
      bombaActual,

      counts: {
        parametros: parametros.length,
        niveles: niveles.length,
        muestras: muestras.length,
        bombas: bombas.length,
        survey: survey.length,
        mapa: mapa ? 1 : 0
      },

      hasData: Boolean(pozo) || parametros.length > 0 || niveles.length > 0 || bombas.length > 0
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
        .map((pozo) => pozo.estado || pozo.estado_nombre || pozo.estado_pozo)
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
      survey,
      detalles
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
      getSurvey(),
      safeGetAll('pozo_detalles')
    ]);

    const activos = pozos.filter((pozo) => {
      const estado = normalizeText(pozo.estado || pozo.estado_nombre || pozo.estado_pozo);
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
        pozo_detalles: detalles.length,
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

  async function getCoverageSample(limit = 20) {
    const pozos = await getPozos();
    const detalles = await safeGetAll('pozo_detalles');

    const detalleIds = new Set(
      detalles
        .map((detalle) => Number(detalle.id || detalle.pozo?.id))
        .filter((id) => Number.isFinite(id))
    );

    const missingDetails = pozos
      .filter((pozo) => !detalleIds.has(Number(pozo.id)))
      .slice(0, limit)
      .map((pozo) => ({
        id: pozo.id,
        codigo: pozo.codigo,
        area: pozo.area
      }));

    const sample = [];

    for (const pozo of pozos.slice(0, limit)) {
      const full = await getPozoFull(pozo.id);

      sample.push({
        id: pozo.id,
        codigo: pozo.codigo,
        area: pozo.area,
        hasPozo: Boolean(full.pozo),
        counts: full.counts,
        hasData: full.hasData
      });
    }

    return {
      totalPozos: pozos.length,
      totalDetalles: detalles.length,
      missingDetails,
      sample
    };
  }

  async function getDiagnostics() {
    try {
      const resumen = await getResumen();
      const coverage = await getCoverageSample(20);

      return {
        ok: true,
        online: navigator.onLine,
        metadata: resumen.info,
        counts: resumen.counts,
        coverage
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
    getCoverageSample,
    getDiagnostics
  };
})();