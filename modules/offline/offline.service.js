const { pool } = require('../../config/db');
const dashboardService = require('../dashboard/dashboard.service');
const pozoService = require('../pozos/pozo.service');

const SAFE_SQL_ERRORS = new Set([
  'ER_NO_SUCH_TABLE',
  'ER_BAD_TABLE_ERROR',
  'ER_VIEW_INVALID',
  'ER_BAD_FIELD_ERROR'
]);

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows || [];
  } catch (error) {
    if (SAFE_SQL_ERRORS.has(error.code)) {
      return fallback;
    }
    throw error;
  }
}

async function getExistingColumns(tableName) {
  const rows = await safeQuery(`DESCRIBE \`${tableName}\``, [], []);
  return rows.map((row) => row.Field);
}

async function buildOfflineSnapshot(currentUser) {
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

  const dashboard = {
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

  const pozos = await safeQuery(
    `
    SELECT p.*, ep.nombre AS estado_nombre
    FROM pozos p
    LEFT JOIN estado_pozo ep ON ep.id = p.id_estado
    ORDER BY p.codigo ASC
  `,
    [],
    []
  );

  const [parametros, niveles, muestras, bombas, servicios, mapaPozos, survey] = await Promise.all([
    safeQuery('SELECT * FROM parametros_diarios ORDER BY fecha DESC, id DESC', [], []),
    safeQuery('SELECT * FROM tomas_nivel ORDER BY fecha DESC, id DESC', [], []),
    safeQuery('SELECT * FROM muestras_fluido ORDER BY fecha DESC, id DESC', [], []),
    safeQuery('SELECT * FROM bombas_historial ORDER BY fecha_inst DESC, id DESC', [], []),
    safeQuery('SELECT * FROM servicios ORDER BY id DESC', [], []),
    safeQuery('SELECT * FROM vw_mapa_pozos_sync ORDER BY id ASC', [], []),
    safeQuery('SELECT * FROM survey WHERE activo = 1 ORDER BY id DESC', [], [])
  ]);

  const pozoDetalles = {};

  pozos.forEach((pozo) => {
    if (pozo && pozo.id != null) {
      const id = Number(pozo.id);
      pozoDetalles[id] = {
        id,
        pozo,
        parametros: Array.isArray(parametros) ? parametros.filter((row) => Number(row.id_pozo) === id) : [],
        niveles: Array.isArray(niveles) ? niveles.filter((row) => Number(row.id_pozo) === id) : [],
        muestras: Array.isArray(muestras) ? muestras.filter((row) => Number(row.id_pozo) === id) : [],
        bombas: Array.isArray(bombas) ? bombas.filter((row) => Number(row.id_pozo) === id) : [],
        survey: Array.isArray(survey) ? survey.filter((row) => Number(row.id_pozo) === id) : []
      };
    }
  });

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
    survey
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
    WHERE id = ?
      AND id_pozo = ?
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

  const allowedFields = ['potencial', 'nota_operativa', 'latitud', 'longitud', 'coord_x', 'coord_y', 'visible'];
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
      `UPDATE pozos SET ${setClauses.join(', ')} WHERE id = ?`,
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
      `UPDATE pozos_diagrama SET ${diagramSetClauses.join(', ')} WHERE id_pozo = ?`,
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
  applyOfflineOperation,
  safeQuery
};
