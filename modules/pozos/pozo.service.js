const db = require('../../config/db');

/**
 * Ejecuta una consulta usando el pool actual.
 */
async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * Convierte valores vacíos a null.
 */
function nullable(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Convierte valores numéricos de forma segura.
 */
function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

/**
 * Convierte una fecha a formato YYYY-MM-DD si es posible.
 */
function toDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

/**
 * Normaliza texto para búsquedas LIKE.
 */
function like(value) {
  return `%${String(value || '').trim()}%`;
}

/**
 * Listado principal de pozos.
 */
async function listPozos(filters = {}) {
  const where = [];
  const params = [];

  if (filters.search) {
    where.push(`(
      p.codigo LIKE ?
      OR p.nombre LIKE ?
      OR p.area LIKE ?
      OR p.yacimiento LIKE ?
      OR p.zona LIKE ?
    )`);

    params.push(
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search)
    );
  }

  if (filters.area) {
    where.push('p.area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    where.push(`COALESCE(ep.nombre, p.estado) = ?`);
    params.push(filters.estado);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return query(
    `
    SELECT
      p.id,
      p.codigo,
      p.nombre,
      p.categoria,
      p.area,
      p.zona,
      p.yacimiento,
      p.potencial,
      p.latitud,
      p.longitud,
      p.coord_x,
      p.coord_y,
      p.diagrama,
      p.visible,
      p.vista_mapa,
      p.vista_diagrama,
      p.fecha_arranque,
      p.vel_operacional,
      p.vel_actual,
      p.rpm,
      p.alto_corte_agua,
      p.nota_operativa,
      p.causa_diferido,

      COALESCE(ep.nombre, p.estado) AS estado,
      COALESCE(cb.nombre, p.cabezal) AS cabezal,
      COALESCE(vd.nombre, p.variador) AS variador,
      COALESCE(ml.nombre, p.metodo_levantamiento) AS metodo_levantamiento,

      bh.marca AS bomba_marca,
      bh.modelo AS bomba_modelo,
      bh.serial_rotor,
      bh.serial_estator,
      bh.fecha_inst AS bomba_fecha_instalacion,
      DATEDIFF(CURDATE(), bh.fecha_inst) AS bomba_tvu_dias

    FROM pozos p
    LEFT JOIN estados_pozo ep
      ON ep.id = p.estado_id
    LEFT JOIN cabezales_bombeo cb
      ON cb.id = p.cabezal_id
    LEFT JOIN variadores vd
      ON vd.id = p.variador_id
    LEFT JOIN metodos_levantamiento ml
      ON ml.id = p.metodo_levantamiento_id
    LEFT JOIN (
      SELECT b1.*
      FROM bombas_historial b1
      INNER JOIN (
        SELECT pozo_id, MAX(COALESCE(fecha_inst, '1900-01-01')) AS max_fecha
        FROM bombas_historial
        GROUP BY pozo_id
      ) ult
        ON ult.pozo_id = b1.pozo_id
       AND ult.max_fecha = COALESCE(b1.fecha_inst, '1900-01-01')
    ) bh
      ON bh.pozo_id = p.id

    ${whereSql}

    ORDER BY
      p.area ASC,
      p.codigo ASC
    `,
    params
  );
}

/**
 * Opciones para filtros del listado.
 */
async function getFilterOptions() {
  const [areas, estados] = await Promise.all([
    query(`
      SELECT DISTINCT area
      FROM pozos
      WHERE area IS NOT NULL AND area <> ''
      ORDER BY area ASC
    `),

    query(`
      SELECT DISTINCT COALESCE(ep.nombre, p.estado) AS estado
      FROM pozos p
      LEFT JOIN estados_pozo ep ON ep.id = p.estado_id
      WHERE COALESCE(ep.nombre, p.estado) IS NOT NULL
        AND COALESCE(ep.nombre, p.estado) <> ''
      ORDER BY estado ASC
    `)
  ]);

  return {
    areas: areas.map((row) => row.area).filter(Boolean),
    estados: estados.map((row) => row.estado).filter(Boolean)
  };
}

/**
 * Detalle base del pozo.
 */
async function getPozoById(id) {
  const rows = await query(
    `
    SELECT
      p.*,

      COALESCE(ep.nombre, p.estado) AS estado,
      COALESCE(cb.nombre, p.cabezal) AS cabezal,
      COALESCE(vd.nombre, p.variador) AS variador,
      COALESCE(ml.nombre, p.metodo_levantamiento) AS metodo_levantamiento

    FROM pozos p
    LEFT JOIN estados_pozo ep
      ON ep.id = p.estado_id
    LEFT JOIN cabezales_bombeo cb
      ON cb.id = p.cabezal_id
    LEFT JOIN variadores vd
      ON vd.id = p.variador_id
    LEFT JOIN metodos_levantamiento ml
      ON ml.id = p.metodo_levantamiento_id

    WHERE p.id = ? OR p.codigo = ?
    LIMIT 1
    `,
    [id, id]
  );

  return rows[0] || null;
}

/**
 * Bomba vigente:
 * se toma la más reciente por fecha_inst.
 */
async function getBombaActualByPozo(pozoId) {
  const rows = await query(
    `
    SELECT
      b.*,
      DATEDIFF(CURDATE(), b.fecha_inst) AS tvu_dias
    FROM bombas_historial b
    WHERE b.pozo_id = ?
    ORDER BY
      b.fecha_inst DESC,
      b.id DESC
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Histórico de bombas del pozo.
 */
async function getHistorialBombasByPozo(pozoId) {
  return query(
    `
    SELECT
      b.*,
      DATEDIFF(CURDATE(), b.fecha_inst) AS tvu_dias
    FROM bombas_historial b
    WHERE b.pozo_id = ?
    ORDER BY
      b.fecha_inst DESC,
      b.id DESC
    `,
    [pozoId]
  );
}

/**
 * Último parámetro operativo.
 */
async function getUltimoParametroByPozo(pozoId) {
  const rows = await query(
    `
    SELECT *
    FROM parametros_historial
    WHERE pozo_id = ?
    ORDER BY
      fecha DESC,
      id DESC
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Último nivel.
 */
async function getUltimoNivelByPozo(pozoId) {
  const rows = await query(
    `
    SELECT *
    FROM niveles_historial
    WHERE pozo_id = ?
    ORDER BY
      fecha DESC,
      id DESC
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Histórico de parámetros.
 */
async function getHistorialParametrosByPozo(pozoId) {
  return query(
    `
    SELECT *
    FROM parametros_historial
    WHERE pozo_id = ?
    ORDER BY
      fecha DESC,
      id DESC
    `,
    [pozoId]
  );
}

/**
 * Histórico de niveles.
 */
async function getHistorialNivelesByPozo(pozoId) {
  return query(
    `
    SELECT *
    FROM niveles_historial
    WHERE pozo_id = ?
    ORDER BY
      fecha DESC,
      id DESC
    `,
    [pozoId]
  );
}

/**
 * Comparativo entre parámetros y niveles por fecha.
 *
 * Une por pozo y fecha. Si tus registros no coinciden exactamente por fecha,
 * luego podemos cambiar esto a búsqueda por fecha más cercana.
 */
async function getComparativoParametrosNivelesByPozo(pozoId) {
  return query(
    `
    SELECT
      COALESCE(n.fecha, p.fecha) AS fecha,

      p.rpm AS parametro_rpm,
      n.rpm AS nivel_rpm,
      (n.rpm - p.rpm) AS dif_rpm,

      p.torque AS parametro_torque,
      n.torque AS nivel_torque,
      (n.torque - p.torque) AS dif_torque,

      p.amp AS parametro_amp,
      n.amp AS nivel_amp,
      (n.amp - p.amp) AS dif_amp,

      p.hp AS parametro_hp,
      n.hp AS nivel_hp,
      (n.hp - p.hp) AS dif_hp,

      p.presion_casing AS parametro_presion_casing,
      n.presion_casing AS nivel_presion_casing,
      (n.presion_casing - p.presion_casing) AS dif_presion_casing,

      p.presion_tubing AS parametro_presion_tubing,
      n.presion_tubing AS nivel_presion_tubing,
      (n.presion_tubing - p.presion_tubing) AS dif_presion_tubing

    FROM niveles_historial n
    LEFT JOIN parametros_historial p
      ON p.pozo_id = n.pozo_id
     AND DATE(p.fecha) = DATE(n.fecha)

    WHERE n.pozo_id = ?

    ORDER BY
      COALESCE(n.fecha, p.fecha) DESC
    `,
    [pozoId]
  );
}

/**
 * Últimas muestras asociadas al pozo.
 */
async function getUltimasMuestrasByPozo(pozoId, limit = 10) {
  return query(
    `
    SELECT *
    FROM muestras_historial
    WHERE pozo_id = ?
    ORDER BY
      fecha DESC,
      id DESC
    LIMIT ?
    `,
    [pozoId, Number(limit) || 10]
  );
}

/**
 * Timeline compacto usado por la ficha.
 */
async function getPozoTimeline(pozoId) {
  const [
    parametros,
    niveles,
    bombas,
    muestras,
    comparativo
  ] = await Promise.all([
    getHistorialParametrosByPozo(pozoId),
    getHistorialNivelesByPozo(pozoId),
    getHistorialBombasByPozo(pozoId),
    getUltimasMuestrasByPozo(pozoId, 20),
    getComparativoParametrosNivelesByPozo(pozoId)
  ]);

  const eventos = [];

  parametros.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'parametro',
      fecha: row.fecha,
      titulo: 'Parámetro operativo',
      descripcion: row.observacion || row.recomendaciones_completas || null,
      data: row
    });
  });

  niveles.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'nivel',
      fecha: row.fecha,
      titulo: 'Toma de nivel',
      descripcion: row.diagnostico || row.recomendacion_ejecutada || row.recomendacion || null,
      data: row
    });
  });

  bombas.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'bomba',
      fecha: row.fecha_inst,
      titulo: 'Bomba instalada',
      descripcion: [row.marca, row.modelo, row.serial_rotor].filter(Boolean).join(' · '),
      data: row
    });
  });

  muestras.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'muestra',
      fecha: row.fecha,
      titulo: 'Muestra',
      descripcion: row.observacion || null,
      data: row
    });
  });

  eventos.sort((a, b) => {
    const dateA = new Date(a.fecha || 0).getTime();
    const dateB = new Date(b.fecha || 0).getTime();
    return dateB - dateA;
  });

  return {
    eventos,
    parametros,
    niveles,
    bombas,
    muestras,
    comparativo
  };
}

/**
 * Bootstrap de datos para APIs internas o vistas.
 */
async function getBootstrapData(pozoId) {
  const pozo = await getPozoById(pozoId);

  if (!pozo) return null;

  const [
    bombaActual,
    historialBombas,
    ultimoParametro,
    ultimoNivel,
    historialParametros,
    historialNiveles,
    comparativoParametrosNiveles,
    ultimasMuestras,
    timeline,
    survey
  ] = await Promise.all([
    getBombaActualByPozo(pozo.id),
    getHistorialBombasByPozo(pozo.id),
    getUltimoParametroByPozo(pozo.id),
    getUltimoNivelByPozo(pozo.id),
    getHistorialParametrosByPozo(pozo.id),
    getHistorialNivelesByPozo(pozo.id),
    getComparativoParametrosNivelesByPozo(pozo.id),
    getUltimasMuestrasByPozo(pozo.id, 10),
    getPozoTimeline(pozo.id),
    getSurveyActivoByPozo(pozo.id)
  ]);

  return {
    pozo,
    bombaActual,
    historialBombas,
    ultimoParametro,
    ultimoNivel,
    historialParametros,
    historialNiveles,
    comparativoParametrosNiveles,
    ultimasMuestras,
    timeline,
    survey
  };
}

/**
 * Survey activo.
 */
async function getSurveyActivoByPozo(pozoId) {
  const rows = await query(
    `
    SELECT *
    FROM surveys_pozo
    WHERE pozo_id = ?
      AND activo = 1
    ORDER BY
      id DESC
    `,
    [pozoId]
  );

  return rows;
}

/**
 * Parsea una tabla pegada desde Excel.
 *
 * Formatos aceptados:
 * MD | TVD | X Offset | Y Offset
 * También intenta leer azimut si viene una quinta columna.
 */
function parseSurveyText(pastedText) {
  const lines = String(pastedText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];

  lines.forEach((line) => {
    const parts = line
      .split(/\t|;|,/)
      .map((part) => part.trim());

    if (parts.length < 4) return;

    const md = toNumber(parts[0]);
    const tvd = toNumber(parts[1]);
    const xOffset = toNumber(parts[2]);
    const yOffset = toNumber(parts[3]);
    const azimut = toNumber(parts[4]);

    if (
      md === null &&
      tvd === null &&
      xOffset === null &&
      yOffset === null
    ) {
      return;
    }

    rows.push({
      md,
      tvd,
      x_offset: xOffset,
      y_offset: yOffset,
      azimut
    });
  });

  return rows;
}

/**
 * Reemplaza el survey activo del pozo.
 */
async function replaceSurveyActivoByPozo(pozoId, pastedText) {
  const rows = parseSurveyText(pastedText);

  if (!rows.length) {
    throw new Error('No se detectaron filas válidas en el survey pegado.');
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE surveys_pozo
      SET activo = 0
      WHERE pozo_id = ?
      `,
      [pozoId]
    );

    for (const row of rows) {
      await conn.query(
        `
        INSERT INTO surveys_pozo (
          pozo_id,
          md,
          tvd,
          x_offset,
          y_offset,
          azimut,
          activo,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        `,
        [
          pozoId,
          row.md,
          row.tvd,
          row.x_offset,
          row.y_offset,
          row.azimut
        ]
      );
    }

    await conn.commit();

    return {
      insertedRows: rows.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Actualiza potencial desde la tabla principal.
 */
async function updatePozoPotencial(id, potencial) {
  const value = toNumber(potencial);

  if (value === null) {
    throw new Error('Potencial inválido.');
  }

  const [result] = await db.query(
    `
    UPDATE pozos
    SET
      potencial = ?,
      updated_at = NOW()
    WHERE id = ? OR codigo = ?
    `,
    [value, id, id]
  );

  return {
    affectedRows: result.affectedRows,
    potencial: value
  };
}

module.exports = {
  listPozos,
  getFilterOptions,

  getPozoById,

  getBombaActualByPozo,
  getHistorialBombasByPozo,

  getUltimoParametroByPozo,
  getUltimoNivelByPozo,
  getHistorialParametrosByPozo,
  getHistorialNivelesByPozo,
  getComparativoParametrosNivelesByPozo,

  getUltimasMuestrasByPozo,
  getPozoTimeline,
  getBootstrapData,

  getSurveyActivoByPozo,
  replaceSurveyActivoByPozo,

  updatePozoPotencial
};