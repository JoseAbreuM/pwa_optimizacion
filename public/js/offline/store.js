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

  async function safeGetByPozo(storeName, idPozo) {
    try { return await getDB().getByPozo(storeName, idPozo); }
    catch (error) { console.warn(`[OfflineStore] No se pudo leer ${storeName} por pozo:`, error); return []; }
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
    const pozo = await safeGet('pozos', numericId, null);

    /**
     * Camino principal:
     * pozo_detalles guardado por snapshot.
     */
    const detalle = await safeGet('pozo_detalles', numericId, null);

    if (detalle) {
      return normalizeDetalle(pozo ? {
        ...detalle,
        pozo: { ...(detalle.pozo || {}), ...pozo }
      } : detalle, Number(id));
    }

    /**
     * Fallback:
     * reconstruir desde store pozos.
     */
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
    const rows = await safeGetByPozo('parametros', idPozo);

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getNivelesByPozo(idPozo) {
    const rows = await safeGetByPozo('niveles', idPozo);

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getMuestrasByPozo(idPozo) {
    const rows = await safeGetByPozo('muestras', idPozo);

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha'));
  }

  async function getBombasByPozo(idPozo) {
    const rows = await safeGetByPozo('bombas', idPozo);

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort(sortByFechaDesc('fecha_inst'));
  }

  async function getSurveyByPozo(idPozo) {
    const rows = await safeGetByPozo('survey', idPozo);

    return rows
      .filter((row) => samePozo(row, idPozo))
      .sort((a, b) => {
        const orderA = Number(a.fila_orden ?? a.orden ?? 0);
        const orderB = Number(b.fila_orden ?? b.orden ?? 0);

        return orderA - orderB;
      });
  }

  async function getProduccionByPozo(idPozo) {
    return (await safeGetByPozo('produccion', idPozo)).sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  }

  async function getPruebasByPozo(idPozo) {
    return (await safeGetByPozo('pruebas', idPozo)).sort((a, b) => String(a.fecha_prueba || '').localeCompare(String(b.fecha_prueba || '')));
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

  function getBombaActual(detalle, bombas, pozo) {
    const bombaFicha = pozo && [pozo.bomba_marca_actual, pozo.bomba_modelo_actual, pozo.bomba_serial_actual, pozo.bomba_fecha_inst_actual].some(value => value != null && value !== '')
      ? { metodo: pozo.bomba_metodo_actual, marca: pozo.bomba_marca_actual, modelo: pozo.bomba_modelo_actual,
          serial: pozo.bomba_serial_actual, fecha_inst: pozo.bomba_fecha_inst_actual,
          fecha_falla: pozo.bomba_fecha_falla_actual, tvu: pozo.bomba_tvu_actual,
          tvu_dias: pozo.bomba_tvu_actual, estatus: pozo.bomba_estatus_actual,
          observaciones: pozo.bomba_observaciones_actual, fuente_actual: pozo.bomba_fuente_actual }
      : null;
    return firstValid(
      detalle?.bombaActual,
      detalle?.bomba_actual,
      detalle?.bomba,
      bombaFicha,
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
      produccionFromStore,
      pruebasFromStore,
      mapaFromStore
    ] = await Promise.all([
      getParametrosByPozo(idPozo),
      getNivelesByPozo(idPozo),
      getMuestrasByPozo(idPozo),
      getBombasByPozo(idPozo),
      getSurveyByPozo(idPozo),
      getProduccionByPozo(idPozo),
      getPruebasByPozo(idPozo),
      getMapaPozo(idPozo)
    ]);

    const normalizedDetalle = detalle ? normalizeDetalle(detalle, Number(idPozo)) : null;

    const pozo = normalizedDetalle?.pozo || null;

    const parametros = mergeRows(
      parametrosFromStore,
      normalizedDetalle?.parametros,
      'fecha'
    );

    const niveles = mergeRows(
      nivelesFromStore,
      normalizedDetalle?.niveles,
      'fecha'
    );

    const muestras = mergeRows(
      muestrasFromStore,
      normalizedDetalle?.muestras,
      'fecha'
    );

    const bombas = mergeRows(
      bombasFromStore,
      normalizedDetalle?.bombas,
      'fecha_inst'
    );

    const survey = surveyFromStore.length ? surveyFromStore : ensureArray(normalizedDetalle?.survey);
    const produccion = produccionFromStore.length ? produccionFromStore : ensureArray(normalizedDetalle?.produccion);
    const pruebas = pruebasFromStore.length ? pruebasFromStore : ensureArray(normalizedDetalle?.pruebas);

    const mapa = normalizedDetalle?.mapa || mapaFromStore || null;

    const ultimoParametro = getUltimoParametro(normalizedDetalle, parametros);
    const ultimoNivel = getUltimoNivel(normalizedDetalle, niveles);
    const bombaActual = getBombaActual(normalizedDetalle, bombas, pozo);

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
      produccion,
      pruebas,

      ultimoParametro,
      ultimoNivel,
      bombaActual,

      counts: {
        parametros: parametros.length,
        niveles: niveles.length,
        muestras: muestras.length,
        bombas: bombas.length,
        survey: survey.length,
        produccion: produccion.length,
        pruebas: pruebas.length,
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
      surveyCount,
      produccionCount,
      pruebasCount,
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
      getDB().count('survey'),
      getDB().count('produccion'),
      getDB().count('pruebas'),
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
        survey: surveyCount,
        produccion: produccionCount,
        pruebas: pruebasCount,
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
    getProduccionByPozo,
    getPruebasByPozo,
    getMapaPozo,

    getPendingQueue,
    getFilterOptions,
    getResumen,
    getCoverageSample,
    getDiagnostics
  };
})();
