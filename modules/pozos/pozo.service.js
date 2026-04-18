const { pool } = require('../../database/db');

function buildWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    clauses.push('(p.codigo LIKE ? OR p.area LIKE ? OR p.yacimiento LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.area) {
    clauses.push('p.area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    clauses.push('p.id_estado = ?');
    params.push(Number(filters.estado));
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
      p.id,
      p.codigo,
      p.categoria,
      p.area,
      p.yacimiento,
      p.potencial,
      p.vel_operacional,
      p.vel_actual,
      p.color_estado_mapa,
      ep.nombre AS estado,
      (
        SELECT MAX(pd.fecha)
        FROM parametros_diarios pd
        WHERE pd.id_pozo = p.id
      ) AS ultima_parametrizacion,
      (
        SELECT MAX(tn.fecha)
        FROM tomas_nivel tn
        WHERE tn.id_pozo = p.id
      ) AS ultimo_nivel,
      (
        SELECT MAX(mf.fecha)
        FROM muestras_fluido mf
        WHERE mf.id_pozo = p.id
      ) AS ultima_muestra
    FROM pozos p
    INNER JOIN estado_pozo ep ON ep.id = p.id_estado
    ${whereSql}
    ORDER BY p.codigo ASC`,
    params
  );

  return rows;
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
