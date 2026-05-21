const { pool } = require('../../config/db');
const dashboardService = require('../dashboard/dashboard.service');

const SAFE_SQL_ERRORS = new Set([
  'ER_NO_SUCH_TABLE',
  'ER_BAD_TABLE_ERROR',
  'ER_VIEW_INVALID',
  'ER_BAD_FIELD_ERROR'
]);

const CHUNK_STORE_CONFIG = {
  dashboard: {
    pageSize: 1,
    countSql: 'SELECT 1 AS total',
    dataSql: null
  },

  pozos: {
    pageSize: 500,
    countSql: `
      SELECT COUNT(*) AS total
      FROM pozos p
    `,
    dataSql: `
      SELECT
        p.*,
        ep.nombre AS estado_nombre
      FROM pozos p
      LEFT JOIN estado_pozo ep ON ep.id = p.id_estado
      ORDER BY p.codigo ASC
      LIMIT ? OFFSET ?
    `
  },

  parametros: {
    pageSize: 1000,
    countSql: `
      SELECT COUNT(*) AS total
      FROM parametros_diarios
    `,
    dataSql: `
      SELECT *
      FROM parametros_diarios
      ORDER BY fecha DESC, id DESC
      LIMIT ? OFFSET ?
    `
  },

  niveles: {
    pageSize: 1000,
    countSql: `
      SELECT COUNT(*) AS total
      FROM tomas_nivel
    `,
    dataSql: `
      SELECT *
      FROM tomas_nivel
      ORDER BY fecha DESC, id DESC
      LIMIT ? OFFSET ?
    `
  },

  muestras: {
    pageSize: 1000,
    countSql: `
      SELECT COUNT(*) AS total
      FROM muestras_fluido
    `,
    dataSql: `
      SELECT *
      FROM muestras_fluido
      ORDER BY fecha DESC, id DESC
      LIMIT ? OFFSET ?
    `
  },

  bombas: {
    pageSize: 1000,
    countSql: `
      SELECT COUNT(*) AS total
      FROM bombas_historial
    `,
    dataSql: `
      SELECT *
      FROM bombas_historial
      ORDER BY fecha_inst DESC, id DESC
      LIMIT ? OFFSET ?
    `
  },

  servicios: {
    pageSize: 500,
    countSql: `
      SELECT COUNT(*) AS total
      FROM servicios
    `,
    dataSql: `
      SELECT *
      FROM servicios
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `
  },

  mapa_pozos: {
    pageSize: 500,
    countSql: `
      SELECT COUNT(*) AS total
      FROM vw_mapa_pozos_sync
    `,
    dataSql: `
      SELECT *
      FROM vw_mapa_pozos_sync
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `
  },

  survey: {
    pageSize: 1000,
    countSql: `
      SELECT COUNT(*) AS total
      FROM survey
      WHERE activo = 1
    `,
    dataSql: `
      SELECT *
      FROM survey
      WHERE activo = 1
      ORDER BY id_pozo ASC, COALESCE(fila_orden, orden, 0) ASC, id ASC
      LIMIT ? OFFSET ?
    `
  }
};

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows || [];
  } catch (error) {
    if (SAFE_SQL_ERRORS.has(error.code)) {
      console.warn('[OFFLINE/SAFE_QUERY]', error.code, error.message);
      return fallback;
    }

    throw error;
  }
}

async function getExistingColumns(tableName) {
  const rows = await safeQuery(`DESCRIBE \`${tableName}\``, [], []);
  return rows.map((row) => row.Field);
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPozoIdFromRow(row) {
  return normalizeNumber(
    row?.id_pozo ??
    row?.pozo_id ??
    row?.idPozo
  );
}

function groupRowsByPozoId(rows = []) {
  const grouped = new Map();

  rows.forEach((row) => {
    const idPozo = getPozoIdFromRow(row);

    if (!idPozo) return;

    if (!grouped.has(idPozo)) {
      grouped.set(idPozo, []);
    }

    grouped.get(idPozo).push(row);
  });

  return grouped;
}

function sortByDateDesc(fieldName = 'fecha') {
  return (a, b) => {
    const dateA = String(a?.[fieldName] || '');
    const dateB = String(b?.[fieldName] || '');
    return dateB.localeCompare(dateA);
  };
}

function getLatest(rows = []) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function buildMapaByPozoId(mapaPozos = []) {
  const map = new Map();

  mapaPozos.forEach((row) => {
    const id = normalizeNumber(row?.id_pozo ?? row?.id);

    if (id && !map.has(id)) {
      map.set(id, row);
    }
  });

  return map;
}

function buildOfflineSummary({
  pozos = [],
  parametros = [],
  niveles = [],
  muestras = [],
  bombas = [],
  servicios = [],
  mapaPozos = [],
  survey = [],
  pozoDetalles = {}
}) {
  const detalles = Object.values(pozoDetalles);

  const pozosSinParametros = detalles
    .filter((detalle) => !detalle.parametros?.length)
    .map((detalle) => detalle.pozo?.codigo || detalle.id);

  const pozosSinNiveles = detalles
    .filter((detalle) => !detalle.niveles?.length)
    .map((detalle) => detalle.pozo?.codigo || detalle.id);

  const pozosSinBombas = detalles
    .filter((detalle) => !detalle.bombas?.length)
    .map((detalle) => detalle.pozo?.codigo || detalle.id);

  return {
    totals: {
      pozos: pozos.length,
      pozoDetalles: detalles.length,
      parametros: parametros.length,
      niveles: niveles.length,
      muestras: muestras.length,
      bombas: bombas.length,
      servicios: servicios.length,
      mapaPozos: mapaPozos.length,
      survey: survey.length
    },
    coverage: {
      pozosConParametros: detalles.filter((detalle) => detalle.parametros?.length).length,
      pozosConNiveles: detalles.filter((detalle) => detalle.niveles?.length).length,
      pozosConBombas: detalles.filter((detalle) => detalle.bombas?.length).length,
      pozosConMuestras: detalles.filter((detalle) => detalle.muestras?.length).length,
      pozosConSurvey: detalles.filter((detalle) => detalle.survey?.length).length,
      pozosConMapa: detalles.filter((detalle) => detalle.mapa).length
    },
    samples: {
      pozosSinParametros: pozosSinParametros.slice(0, 20),
      pozosSinNiveles: pozosSinNiveles.slice(0, 20),
      pozosSinBombas: pozosSinBombas.slice(0, 20)
    }
  };
}

async function getDashboardSnapshot(currentUser) {
  let dashboardSource = {
    kpis: null,
    categorias: [],
    servicios: [],
    muestrasAlerta: [],
    bombasCriticas: [],
    potencialPorArea: {
      labels: [],
      values: [],
      colors: []
    }
  };

  try {
    dashboardSource = await dashboardService.getDashboardData(currentUser);
  } catch (error) {
    console.warn('[OFFLINE/SNAPSHOT] No se pudo cargar dashboard:', error.message || error);
  }

  return {
    kpis: dashboardSource.kpis || null,
    categorias: dashboardSource.categorias || [],
    servicios: dashboardSource.servicios || [],
    muestrasAlerta: dashboardSource.muestrasAlerta || [],
    bombasCriticas: dashboardSource.bombasCriticas || [],
    potencialPorArea: dashboardSource.potencialPorArea || {
      labels: [],
      values: [],
      colors: []
    }
  };
}

async function getCountFromSql(sql) {
  const rows = await safeQuery(sql, [], [{ total: 0 }]);
  return Number(rows[0]?.total || 0);
}

async function buildOfflineManifest(currentUser) {
  const dashboard = await getDashboardSnapshot(currentUser);

  const entries = await Promise.all(
    Object.entries(CHUNK_STORE_CONFIG).map(async ([store, config]) => {
      if (store === 'dashboard') {
        return [
          store,
          {
            store,
            total: 1,
            pageSize: 1,
            pages: 1
          }
        ];
      }

      const total = await getCountFromSql(config.countSql);
      const pageSize = Number(config.pageSize || 1000);
      const pages = Math.max(1, Math.ceil(total / pageSize));

      return [
        store,
        {
          store,
          total,
          pageSize,
          pages
        }
      ];
    })
  );

  const tables = Object.fromEntries(entries);

  return {
    version: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    tables,
    dashboard
  };
}

async function getOfflineChunk(storeName, options = {}, currentUser = null) {
  const store = String(storeName || '').trim();

  if (!CHUNK_STORE_CONFIG[store]) {
    return {
      ok: false,
      store,
      message: `Store offline no soportado: ${store}`
    };
  }

  const config = CHUNK_STORE_CONFIG[store];

  const requestedPage = Number(options.page || 1);
  const requestedPageSize = Number(options.pageSize || config.pageSize || 1000);

  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 5000)
    : config.pageSize;

  if (store === 'dashboard') {
    const dashboard = await getDashboardSnapshot(currentUser);

    return {
      ok: true,
      store,
      page: 1,
      pageSize: 1,
      total: 1,
      pages: 1,
      rows: [{
        key: 'main',
        ...dashboard
      }]
    };
  }

  const total = await getCountFromSql(config.countSql);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const offset = (safePage - 1) * pageSize;

  const rows = await safeQuery(
    config.dataSql,
    [pageSize, offset],
    []
  );

  return {
    ok: true,
    store,
    page: safePage,
    pageSize,
    total,
    pages,
    rows
  };
}

async function buildOfflineSnapshot(currentUser) {
  const dashboard = await getDashboardSnapshot(currentUser);

  const pozos = await safeQuery(
    `
      SELECT
        p.*,
        ep.nombre AS estado_nombre
      FROM pozos p
      LEFT JOIN estado_pozo ep ON ep.id = p.id_estado
      ORDER BY p.codigo ASC
    `,
    [],
    []
  );

  const [
    parametrosRaw,
    nivelesRaw,
    muestrasRaw,
    bombasRaw,
    servicios,
    mapaPozos,
    surveyRaw
  ] = await Promise.all([
    safeQuery(
      `
        SELECT *
        FROM parametros_diarios
        ORDER BY fecha DESC, id DESC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM tomas_nivel
        ORDER BY fecha DESC, id DESC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM muestras_fluido
        ORDER BY fecha DESC, id DESC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM bombas_historial
        ORDER BY fecha_inst DESC, id DESC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM servicios
        ORDER BY id DESC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM vw_mapa_pozos_sync
        ORDER BY id ASC
      `,
      [],
      []
    ),
    safeQuery(
      `
        SELECT *
        FROM survey
        WHERE activo = 1
        ORDER BY id DESC
      `,
      [],
      []
    )
  ]);

  const parametros = parametrosRaw.sort(sortByDateDesc('fecha'));
  const niveles = nivelesRaw.sort(sortByDateDesc('fecha'));
  const muestras = muestrasRaw.sort(sortByDateDesc('fecha'));
  const bombas = bombasRaw.sort(sortByDateDesc('fecha_inst'));
  const survey = surveyRaw.sort((a, b) => {
    const pozoA = Number(a.id_pozo || 0);
    const pozoB = Number(b.id_pozo || 0);

    if (pozoA !== pozoB) return pozoA - pozoB;

    const orderA = Number(a.fila_orden ?? a.orden ?? 0);
    const orderB = Number(b.fila_orden ?? b.orden ?? 0);

    return orderA - orderB;
  });

  const parametrosByPozo = groupRowsByPozoId(parametros);
  const nivelesByPozo = groupRowsByPozoId(niveles);
  const muestrasByPozo = groupRowsByPozoId(muestras);
  const bombasByPozo = groupRowsByPozoId(bombas);
  const surveyByPozo = groupRowsByPozoId(survey);
  const mapaByPozo = buildMapaByPozoId(mapaPozos);

  const pozoDetalles = {};

  pozos.forEach((pozo) => {
    const id = normalizeNumber(pozo?.id);

    if (!id) return;

    const parametrosPozo = parametrosByPozo.get(id) || [];
    const nivelesPozo = nivelesByPozo.get(id) || [];
    const muestrasPozo = muestrasByPozo.get(id) || [];
    const bombasPozo = bombasByPozo.get(id) || [];
    const surveyPozo = surveyByPozo.get(id) || [];
    const mapaPozo = mapaByPozo.get(id) || null;

    pozoDetalles[id] = {
      id,
      pozo,
      mapa: mapaPozo,

      parametros: parametrosPozo,
      niveles: nivelesPozo,
      muestras: muestrasPozo,
      bombas: bombasPozo,
      survey: surveyPozo,

      ultimoParametro: getLatest(parametrosPozo),
      ultimoNivel: getLatest(nivelesPozo),
      bombaActual: getLatest(bombasPozo),

      counts: {
        parametros: parametrosPozo.length,
        niveles: nivelesPozo.length,
        muestras: muestrasPozo.length,
        bombas: bombasPozo.length,
        survey: surveyPozo.length,
        mapa: mapaPozo ? 1 : 0
      }
    };
  });

  const offlineSummary = buildOfflineSummary({
    pozos,
    parametros,
    niveles,
    muestras,
    bombas,
    servicios,
    mapaPozos,
    survey,
    pozoDetalles
  });

  console.info('[OFFLINE/SNAPSHOT] Snapshot construido:', offlineSummary);

  return {
    version: new Date().toISOString(),
    serverTime: new Date().toISOString(),

    dashboard,
    pozos,
    pozoDetalles,

    parametros,
    niveles,
    muestras,
    bombas,
    servicios,
    mapaPozos,
    survey,

    offlineSummary
  };
}

async function applyOfflineOperation(operation = {}, currentUser) {
  if (!operation || !operation.type) {
    return {
      ok: false,
      unsupported: true,
      message: 'Tipo de operación no soportado.'
    };
  }

  switch (operation.type) {
    case 'MUESTRA_REPRESENTATIVA_UPDATE':
      return applyMuestraRepresentativa(operation.payload);

    case 'POZO_BASIC_UPDATE':
      return applyPozoBasicUpdate(operation.payload);

    default:
      return {
        ok: false,
        unsupported: true,
        message: 'Tipo de operación no soportado.'
      };
  }
}

async function applyMuestraRepresentativa(payload = {}) {
  const { id_pozo, id_muestra, representativa } = payload;

  if (!Number.isFinite(Number(id_pozo)) || !Number.isFinite(Number(id_muestra))) {
    return {
      ok: false,
      message: 'Payload inválido para MUESTRA_REPRESENTATIVA_UPDATE.'
    };
  }

  const [result] = await pool.query(
    `
      UPDATE muestras_fluido
      SET representativa = ?
      WHERE id = ? AND id_pozo = ?
    `,
    [representativa ? 1 : 0, id_muestra, id_pozo]
  );

  if (!result || result.affectedRows === 0) {
    return {
      ok: false,
      message: 'No se encontró la muestra para este pozo.'
    };
  }

  return {
    ok: true,
    affectedRows: result.affectedRows,
    representativa: representativa ? 1 : 0,
    message: 'Muestra actualizada correctamente.'
  };
}

async function applyPozoBasicUpdate(payload = {}) {
  const { id_pozo } = payload;

  if (!Number.isFinite(Number(id_pozo))) {
    return {
      ok: false,
      message: 'Payload inválido para POZO_BASIC_UPDATE.'
    };
  }

  const allowedFields = [
    'potencial',
    'nota_operativa',
    'latitud',
    'longitud',
    'coord_x',
    'coord_y',
    'visible'
  ];

  const values = {};

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      values[field] = payload[field];
    }
  });

  if (!Object.keys(values).length) {
    return {
      ok: false,
      message: 'No hay campos actualizables en el payload.'
    };
  }

  const pozoColumns = await getExistingColumns('pozos');
  const setClauses = [];
  const params = [];

  Object.entries(values).forEach(([field, value]) => {
    if (pozoColumns.includes(field)) {
      setClauses.push(`\`${field}\` = ?`);
      params.push(value);
    }
  });

  let affectedRows = 0;

  if (setClauses.length) {
    params.push(id_pozo);

    const [result] = await pool.query(
      `
        UPDATE pozos
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `,
      params
    );

    affectedRows += result.affectedRows;
  }

  const diagramColumns = await getExistingColumns('pozos_diagrama');
  const diagramSetClauses = [];
  const diagramParams = [];

  Object.entries(values).forEach(([field, value]) => {
    if (diagramColumns.includes(field)) {
      diagramSetClauses.push(`\`${field}\` = ?`);
      diagramParams.push(value);
    }
  });

  if (diagramSetClauses.length) {
    diagramParams.push(id_pozo);

    const [diagramResult] = await pool.query(
      `
        UPDATE pozos_diagrama
        SET ${diagramSetClauses.join(', ')}
        WHERE id_pozo = ?
      `,
      diagramParams
    );

    affectedRows += diagramResult.affectedRows;
  }

  if (!affectedRows) {
    return {
      ok: false,
      message: 'No se actualizó ningún campo; revisa las columnas disponibles.'
    };
  }

  return {
    ok: true,
    affectedRows,
    message: 'Pozo actualizado correctamente.'
  };
}

module.exports = {
  buildOfflineSnapshot,
  buildOfflineManifest,
  getOfflineChunk,
  applyOfflineOperation,
  safeQuery
};