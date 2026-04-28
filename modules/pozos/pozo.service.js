const { pool } = require('../../config/db');

function buildWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    clauses.push(`(
      codigo LIKE ?
      OR area LIKE ?
      OR yacimiento LIKE ?
      OR estado LIKE ?
      OR categoria LIKE ?
      OR variador LIKE ?
      OR cabezal LIKE ?
      OR metodo_levantamiento LIKE ?
    )`);

    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term, term, term, term);
  }

  if (filters.area) {
    clauses.push('area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    clauses.push('estado = ?');
    params.push(filters.estado);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

async function listPozos(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters);

  const [rows] = await pool.query(
  `SELECT
    id,
    codigo,
    categoria,
    area,
    yacimiento,
    potencial,
    vel_actual,
    vel_operacional,
    color_estado_mapa,
    estado,
    metodo_levantamiento,
    cabezal,
    variador,
    ultima_parametrizacion,
    ultimo_nivel,
    ultima_muestra,
    prox_muestra
  FROM vw_pozos_listado
  ${whereSql}
  ORDER BY codigo ASC`,
  params
);

  return rows;
}

async function getFilterOptions() {
  const [[areas], [estados]] = await Promise.all([
    pool.query(`
      SELECT DISTINCT area
      FROM vw_pozos_listado
      WHERE area IS NOT NULL AND area <> ''
      ORDER BY area ASC
    `),
    pool.query(`
      SELECT DISTINCT estado AS nombre
      FROM vw_pozos_listado
      WHERE estado IS NOT NULL AND estado <> ''
      ORDER BY estado ASC
    `)
  ]);

  return {
    areas,
    estados
  };
}

async function getPozoById(id) {
  const [rows] = await pool.query(
    `SELECT
      p.*,
      ep.nombre AS estado,
      v.marca AS marca_vdf,
      v.capacidad AS capacidad_vdf,
      c.marca AS cabezal,
      ml.nombre AS metodo_levantamiento
    FROM pozos p
    INNER JOIN estado_pozo ep ON ep.id = p.id_estado
    LEFT JOIN vdfs v ON v.id = p.id_vdf
    LEFT JOIN cabezales c ON c.id = p.id_cabezal
    LEFT JOIN metodos_levantamiento ml ON ml.id = p.id_metodo
    WHERE p.id = ?
    LIMIT 1`,
    [Number(id)]
  );

  return rows[0] || null;
}

async function getPozoTimeline(id) {
  const pozoId = Number(id);

  const [parametros] = await pool.query(
    `SELECT fecha, torque, amp, freq, volts, rpm, hp
     FROM parametros_diarios
     WHERE id_pozo = ?
     ORDER BY fecha DESC
     LIMIT 10`,
    [pozoId]
  );

  const [niveles] = await pool.query(
    `SELECT fecha, nf_pies, sumergencia, pip, pbhp, presion_casing, diagnostico
     FROM tomas_nivel
     WHERE id_pozo = ?
     ORDER BY fecha DESC
     LIMIT 10`,
    [pozoId]
  );

  const [muestras] = await pool.query(
    `SELECT fecha, ays, api, representativa, prox_muestra
     FROM muestras_fluido
     WHERE id_pozo = ?
     ORDER BY fecha DESC
     LIMIT 10`,
    [pozoId]
  );

  const [servicios] = await pool.query(
    `SELECT sp.fecha_est, sp.tipo_servicio, sp.prioridad, sp.estatus_prog, us.nombre AS unidad
     FROM servicios_programados sp
     INNER JOIN unidades_servicio us ON us.id = sp.id_unidad
     WHERE sp.id_pozo = ?
     ORDER BY sp.fecha_est DESC
     LIMIT 10`,
    [pozoId]
  );

  return {
    parametros,
    niveles,
    muestras,
    servicios
  };
}

async function getFilterOptions() {
  const [[areas], [estados]] = await Promise.all([
    pool.query(`SELECT DISTINCT area FROM pozos WHERE area IS NOT NULL AND area <> '' ORDER BY area ASC`),
    pool.query(`SELECT id, nombre FROM estado_pozo ORDER BY nombre ASC`)
  ]);

  return {
    areas,
    estados
  };
}

async function getBootstrapData() {
  const [[pozos], [bombas], [parametrosDiarios], [niveles], [muestras]] = await Promise.all([
    pool.query(`SELECT id, codigo, area, categoria, color_estado_mapa FROM pozos ORDER BY codigo ASC LIMIT 100`),
    pool.query(`SELECT id, id_pozo, marca, modelo, fecha_inst, estatus FROM bombas_historial ORDER BY fecha_inst DESC LIMIT 100`),
    pool.query(`SELECT id, id_pozo, fecha, torque, amp, freq, rpm, hp FROM parametros_diarios ORDER BY fecha DESC LIMIT 100`),
    pool.query(`SELECT id, id_pozo, fecha, nf_pies, sumergencia, pip, pbhp FROM tomas_nivel ORDER BY fecha DESC LIMIT 100`),
    pool.query(`SELECT id, id_pozo, fecha, ays, api, prox_muestra FROM muestras_fluido ORDER BY fecha DESC LIMIT 100`)
  ]);

  return {
    timestamp: new Date().toISOString(),
    pozos,
    bombas,
    parametrosDiarios,
    niveles,
    muestras
  };
}

module.exports = {
  listPozos,
  getPozoById,
  getPozoTimeline,
  getFilterOptions,
  getBootstrapData
};
