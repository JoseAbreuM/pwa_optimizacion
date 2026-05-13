const { pool } = require('../../config/db');

/**
 * Ejecuta una consulta usando el pool actual.
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
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
 * Normaliza texto para búsquedas LIKE.
 */
function like(value) {
  return `%${String(value || '').trim()}%`;
}

/**
 * Listado principal de pozos.
 *
 * Usa la vista real:
 * - vw_pozos_listado
 */
async function listPozos(filters = {}) {
  const where = [];
  const params = [];

  if (filters.search) {
    where.push(`(
      codigo LIKE ?
      OR area LIKE ?
      OR yacimiento LIKE ?
      OR estado LIKE ?
      OR metodo_levantamiento LIKE ?
      OR cabezal LIKE ?
      OR variador LIKE ?
      OR servicio_asignado LIKE ?
    )`);

    params.push(
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search),
      like(filters.search)
    );
  }

  if (filters.area) {
    where.push('area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    where.push('estado = ?');
    params.push(filters.estado);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return query(
    `
    SELECT
      id,
      codigo,
      categoria,
      area,
      yacimiento,
      potencial,
      latitud,
      longitud,
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
      prox_muestra,
      servicio_asignado,
      tipo_servicio,
      subtipo_servicio
    FROM vw_pozos_listado
    ${whereSql}
    ORDER BY
      area ASC,
      codigo ASC
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
      WHERE area IS NOT NULL
        AND area <> ''
      ORDER BY area ASC
    `),

    query(`
      SELECT DISTINCT nombre AS estado
      FROM estado_pozo
      WHERE nombre IS NOT NULL
        AND nombre <> ''
      ORDER BY nombre ASC
    `)
  ]);

  return {
    areas: areas.map((row) => row.area).filter(Boolean),
    estados: estados.map((row) => row.estado).filter(Boolean)
  };
}

/**
 * Detalle base del pozo.
 *
 * Usa la vista real:
 * - vw_pozo_ficha_general
 */
async function getPozoById(id) {
  const rows = await query(
    `
    SELECT *
    FROM vw_pozo_ficha_general
    WHERE id = ? OR codigo = ?
    LIMIT 1
    `,
    [id, id]
  );

  return rows[0] || null;
}

/**
 * Bomba vigente del pozo.
 *
 * Usa la vista real:
 * - vw_pozo_bomba_actual
 */
async function getBombaActualByPozo(pozoId) {
  const rows = await query(
    `
    SELECT
      id_pozo,
      codigo,
      categoria,
      estado_pozo,
      metodo,
      marca,
      modelo,
      serial,
      fecha_inst,
      fecha_falla,
      tvu,
      tvu AS tvu_dias,
      estatus,
      observaciones,
      fuente_actual
    FROM vw_pozo_bomba_actual
    WHERE id_pozo = ?
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Histórico de bombas del pozo.
 *
 * Usa la vista real:
 * - vw_pozo_bombas_historial
 */
async function getHistorialBombasByPozo(pozoId) {
  return query(
    `
    SELECT
      id_pozo,
      codigo,
      id,
      metodo,
      marca,
      modelo,
      serial,
      fecha_inst,
      fecha_falla,
      tvu,
      tvu AS tvu_dias,
      estatus,
      observaciones
    FROM vw_pozo_bombas_historial
    WHERE id_pozo = ?
    ORDER BY
      fecha_inst DESC,
      id DESC
    `,
    [pozoId]
  );
}

/**
 * Último parámetro operativo.
 *
 * Usa la vista real:
 * - vw_ultimo_parametro_pozo
 */
async function getUltimoParametroByPozo(pozoId) {
  const rows = await query(
    `
    SELECT
      id,
      id_pozo,
      fecha,
      torque,
      amp,
      freq,
      volts,
      rpm,
      hp,
      vel_operacional,
      vel_actual,
      presion_casing,
      presion_tubing,
      observacion,
      diagnostico,
      recomendacion,
      recomendaciones,
      comentario,
      COALESCE(recomendaciones, recomendacion, comentario, observacion) AS recomendaciones_completas,
      sync_status,
      uuid_local
    FROM vw_ultimo_parametro_pozo
    WHERE id_pozo = ?
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Último nivel.
 *
 * Usa la vista real:
 * - vw_ultimo_nivel_pozo
 */
async function getUltimoNivelByPozo(pozoId) {
  const rows = await query(
    `
    SELECT *
    FROM vw_ultimo_nivel_pozo
    WHERE id_pozo = ?
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Histórico de parámetros.
 *
 * Tabla real:
 * - parametros_diarios
 */
async function getHistorialParametrosByPozo(pozoId) {
  return query(
    `
    SELECT
      id,
      uuid_local,
      id_pozo,
      fecha,
      torque,
      amp,
      freq,
      volts,
      rpm,
      hp,
      vel_operacional,
      vel_actual,
      pip,
      pbhp,
      presion_casing,
      presion_tubing,
      nf_pies,
      porcentaje_liq,
      diagnostico,
      recomendacion,
      recomendaciones,
      ajustes_realizados,
      comentario,
      observacion,
      COALESCE(recomendaciones, recomendacion, comentario, observacion) AS recomendaciones_completas,
      sync_status,
      id_personal,
      id_usuario_carga
    FROM parametros_diarios
    WHERE id_pozo = ?
    ORDER BY
      fecha DESC,
      id DESC
    `,
    [pozoId]
  );
}

/**
 * Histórico de niveles.
 *
 * Tabla real:
 * - tomas_nivel
 */
async function getHistorialNivelesByPozo(pozoId) {
  return query(
    `
    SELECT
      id,
      id_pozo,
      fecha,
      nf_pies,
      sumergencia,
      porcentaje_liq,
      pip,
      pbhp,
      presion_casing,
      presion_tubing,
      torque,
      amp,
      freq,
      volts,
      rpm,
      hp,
      diagnostico,
      observacion,
      comentario,
      recomendacion_ejecutada,
      recomendacion,
      sync_status,
      id_personal,
      uuid_local,
      id_usuario_carga
    FROM tomas_nivel
    WHERE id_pozo = ?
    ORDER BY
      fecha DESC,
      id DESC
    `,
    [pozoId]
  );
}

/**
 * Comparativo entre parámetros y niveles.
 *
 * Usa la vista real:
 * - vw_comparativo_parametros_niveles
 */
async function getComparativoParametrosNivelesByPozo(pozoId) {
  return query(
    `
    SELECT
      *
    FROM vw_comparativo_parametros_niveles
    WHERE id_pozo = ?
    ORDER BY
      fecha DESC
    `,
    [pozoId]
  );
}

/**
 * Últimas muestras asociadas al pozo.
 *
 * Usa la vista real:
 * - vw_pozo_muestras_historial
 */
async function getUltimasMuestrasByPozo(pozoId, limit = 10) {
  return query(
    `
    SELECT
      id_pozo,
      codigo,
      id,
      fecha,
      ays,
      api,
      representativa,
      prox_muestra,
      sync_status,
      id_personal,
      uuid_local
    FROM vw_pozo_muestras_historial
    WHERE id_pozo = ?
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
      descripcion:
        row.recomendaciones_completas ||
        row.recomendaciones ||
        row.recomendacion ||
        row.comentario ||
        row.observacion ||
        null,
      data: row
    });
  });

  niveles.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'nivel',
      fecha: row.fecha,
      titulo: 'Toma de nivel',
      descripcion:
        row.diagnostico ||
        row.recomendacion_ejecutada ||
        row.recomendacion ||
        row.comentario ||
        row.observacion ||
        null,
      data: row
    });
  });

  bombas.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'bomba',
      fecha: row.fecha_inst,
      titulo: 'Bomba instalada',
      descripcion: [row.marca, row.modelo, row.serial].filter(Boolean).join(' · '),
      data: row
    });
  });

  muestras.slice(0, 10).forEach((row) => {
    eventos.push({
      tipo: 'muestra',
      fecha: row.fecha,
      titulo: 'Muestra',
      descripcion: row.prox_muestra ? `Próxima muestra: ${row.prox_muestra}` : null,
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
 *
 * Tabla real:
 * - pozo_survey
 */
async function getSurveyActivoByPozo(pozoId) {
  return query(
    `
    SELECT
      id,
      id_pozo,
      fila_orden,
      md,
      tvd,
      x_offset,
      y_offset,
      delta_x,
      delta_y,
      azimut,
      lote_carga,
      raw_payload,
      activo,
      created_at,
      updated_at
    FROM pozo_survey
    WHERE id_pozo = ?
      AND activo = 1
    ORDER BY
      fila_orden ASC,
      id ASC
    `,
    [pozoId]
  );
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
 *
 * Tabla real:
 * - pozo_survey
 */
async function replaceSurveyActivoByPozo(pozoId, pastedText) {
  const rows = parseSurveyText(pastedText);

  if (!rows.length) {
    throw new Error('No se detectaron filas válidas en el survey pegado.');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE pozo_survey
      SET activo = 0
      WHERE id_pozo = ?
      `,
      [pozoId]
    );

    for (const [index, row] of rows.entries()) {
      await conn.query(
        `
        INSERT INTO pozo_survey (
          id_pozo,
          fila_orden,
          md,
          tvd,
          x_offset,
          y_offset,
          azimut,
          lote_carga,
          activo,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `,
        [
          pozoId,
          index + 1,
          row.md,
          row.tvd,
          row.x_offset,
          row.y_offset,
          row.azimut,
          `manual-${Date.now()}`
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

  const [result] = await pool.query(
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