const { pool } = require('../../config/db');

/**
 * Construye dinámicamente el WHERE del listado de pozos.
 * 
 * Esta función se usa sobre la vista vw_pozos_listado.
 * Por eso los campos del WHERE deben existir en esa vista:
 * - codigo
 * - area
 * - yacimiento
 * - estado
 * - categoria
 * - variador
 * - cabezal
 * - metodo_levantamiento
 */
function buildWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    clauses.push(`(
      vpl.codigo LIKE ?
      OR vpl.area LIKE ?
      OR vpl.yacimiento LIKE ?
      OR vpl.estado LIKE ?
      OR vpl.categoria LIKE ?
      OR vpl.variador LIKE ?
      OR vpl.cabezal LIKE ?
      OR vpl.metodo_levantamiento LIKE ?
    )`);

    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term, term, term, term);
  }

  if (filters.area) {
    clauses.push('vpl.area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    clauses.push('vpl.estado = ?');
    params.push(filters.estado);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * Lista los pozos para la tabla principal.
 *
 * Importante:
 * Las velocidades vigentes salen del último registro de parametros_diarios.
 * Si el pozo aún no tiene parámetros, usa los valores guardados en pozos/vista como respaldo.
 */
/**
 * Lista los pozos para la tabla principal.
 *
 * Importante:
 * Las velocidades vigentes salen del último registro de parametros_diarios.
 * Si el pozo aún no tiene parámetros, usa los valores guardados en la vista o en pozos como respaldo.
 */
async function listPozos(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters);

  const [rows] = await pool.query(
    `SELECT
      vpl.id,
      vpl.codigo,
      vpl.categoria,
      vpl.area,
      vpl.yacimiento,
      vpl.potencial,
      vpl.color_estado_mapa,
      vpl.estado,
      vpl.metodo_levantamiento,
      vpl.cabezal,
      vpl.variador,
      vpl.ultima_parametrizacion,
      vpl.ultimo_nivel,
      vpl.ultima_muestra,
      vpl.prox_muestra,

      vel.vel_actual,
      vel.vel_operacional

    FROM vw_pozos_listado vpl

    LEFT JOIN (
      SELECT
        p.id AS id_pozo,

        (
          SELECT COALESCE(pd.vel_actual, pd.rpm)
          FROM parametros_diarios pd
          WHERE pd.id_pozo = p.id
            AND COALESCE(pd.vel_actual, pd.rpm) IS NOT NULL
            AND COALESCE(pd.vel_actual, pd.rpm) <> ''
          ORDER BY pd.fecha DESC, pd.id DESC
          LIMIT 1
        ) AS vel_actual,

        (
          SELECT pd.vel_operacional
          FROM parametros_diarios pd
          WHERE pd.id_pozo = p.id
            AND pd.vel_operacional IS NOT NULL
            AND pd.vel_operacional <> ''
          ORDER BY pd.fecha DESC, pd.id DESC
          LIMIT 1
        ) AS vel_operacional

      FROM pozos p
    ) vel
      ON vel.id_pozo = vpl.id

    ${whereSql}
    ORDER BY vpl.codigo ASC`,
    params
  );

  return rows;
}

/**
 * Opciones para los filtros del listado.
 * 
 * IMPORTANTE:
 * Como el listado sale de vw_pozos_listado,
 * las opciones también deben salir de la misma vista.
 */
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


/**
 * Obtiene los datos principales de un pozo por ID.
 *
 * Prioridad para equipos:
 * 1) pozo_equipos_actuales: tabla consolidada por pozo.
 * 2) stg_parametros_extra: respaldo desde Excel extra.
 * 3) motores_cabezales / cabezal_historial.
 * 4) cabezales / vdfs.
 */
async function getPozoById(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      p.*,

      ep.nombre AS estado,
      ml.nombre AS metodo_levantamiento,

      /*
        Variador actual.
        Prioridad:
        1) pozo_equipos_actuales
        2) stg_parametros_extra
        3) vdfs
      */
      COALESCE(
        NULLIF(eq.variador_nombre_original, ''),
        NULLIF(param_extra.variador, ''),
        NULLIF(v.marca, '')
      ) AS marca_vdf,

      COALESCE(
        NULLIF(eq.variador_nombre_original, ''),
        NULLIF(param_extra.variador, ''),
        NULLIF(v.marca, '')
      ) AS variador,

      COALESCE(
        eq.variador_capacidad_hp,
        param_extra.potencia_variador,
        NULLIF(v.capacidad, '')
      ) AS capacidad_vdf,

      COALESCE(
        eq.variador_capacidad_hp,
        param_extra.potencia_variador,
        NULLIF(v.capacidad, '')
      ) AS potencia_variador,

      /*
        Cabezal actual.
        Prioridad:
        1) pozo_equipos_actuales
        2) stg_parametros_extra
        3) cabezales
      */
      COALESCE(
        NULLIF(eq.cabezal_nombre_original, ''),
        NULLIF(param_extra.cabezal, ''),
        NULLIF(c.marca, '')
      ) AS cabezal,

      c.modelo AS cabezal_modelo,
      c.capacidad_klbs AS capacidad_cabezal_klbs,
      c.serial AS serial_cabezal,

      /*
        Motores / configuración del cabezal.
        Aquí está el dato que no se estaba visualizando.
      */
      COALESCE(
        NULLIF(eq.cabezal_configuracion_motor, ''),
        NULLIF(param_extra.configuracion_motor, ''),
        NULLIF(motores.configuracion_motor, ''),
        NULLIF(hist_cabezal.configuracion_motor, '')
      ) AS configuracion_motor,

      COALESCE(
        NULLIF(eq.cabezal_configuracion_motor, ''),
        NULLIF(param_extra.configuracion_motor, ''),
        NULLIF(motores.configuracion_motor, ''),
        NULLIF(hist_cabezal.configuracion_motor, '')
      ) AS motores_cabezal,

      COALESCE(
        eq.cabezal_cantidad_motores,
        param_extra.cantidad_motores,
        motores.cantidad_motores,
        hist_cabezal.cantidad_motores
      ) AS cantidad_motores,

      COALESCE(
        eq.cabezal_hp_motor,
        param_extra.hp_motor,
        motores.hp_motor,
        hist_cabezal.hp_motor,
        NULLIF(c.hp, '')
      ) AS hp_motor_cabezal,

      COALESCE(
        eq.cabezal_hp_total,
        param_extra.hp_total,
        param_extra.potencia_cabezal,
        motores.hp_total_motores,
        hist_cabezal.hp_total_motores,
        NULLIF(c.potencia_motor, ''),
        NULLIF(c.hp, '')
      ) AS hp_total_motores,

      COALESCE(
        eq.cabezal_hp_total,
        param_extra.potencia_cabezal,
        param_extra.hp_total,
        motores.hp_total_motores,
        hist_cabezal.hp_total_motores,
        NULLIF(c.potencia_motor, ''),
        NULLIF(c.hp, '')
      ) AS potencia_cabezal,

      motores.seriales_motores,
      motores.marcas_motores,

      /*
        Últimas velocidades desde parametros_diarios.
      */
      vel.vel_actual AS vel_actual_parametro,
      vel.vel_operacional AS vel_operacional_parametro,

      COALESCE(vel.vel_actual, p.vel_actual) AS vel_actual,
      COALESCE(vel.vel_operacional, p.vel_operacional) AS vel_operacional

    FROM pozos p

    LEFT JOIN estado_pozo ep
      ON ep.id = p.id_estado

    LEFT JOIN metodos_levantamiento ml
      ON ml.id = p.id_metodo

    LEFT JOIN vdfs v
      ON v.id = p.id_vdf

    LEFT JOIN cabezales c
      ON c.id = p.id_cabezal

    /*
      Equipo consolidado actual por pozo.
      Este debe ser la fuente principal.
    */
    LEFT JOIN pozo_equipos_actuales eq
      ON eq.id = (
        SELECT eq2.id
        FROM pozo_equipos_actuales eq2
        WHERE eq2.id_pozo = p.id
        ORDER BY eq2.fecha_referencia DESC, eq2.id DESC
        LIMIT 1
      )

    /*
      Respaldo: último registro extra con datos útiles de equipos.
      No tomamos simplemente la última fecha general, sino la última fila
      que tenga algún dato de variador/cabezal/motores/potencia.
    */
    LEFT JOIN stg_parametros_extra param_extra
      ON param_extra.id = (
        SELECT x.id
        FROM stg_parametros_extra x
        WHERE UPPER(TRIM(x.codigo_pozo_normalizado)) = UPPER(TRIM(p.codigo))
          AND (
            NULLIF(x.variador, '') IS NOT NULL
            OR x.potencia_variador IS NOT NULL
            OR NULLIF(x.cabezal, '') IS NOT NULL
            OR NULLIF(x.configuracion_motor, '') IS NOT NULL
            OR x.potencia_cabezal IS NOT NULL
            OR x.cantidad_motores IS NOT NULL
            OR x.hp_motor IS NOT NULL
            OR x.hp_total IS NOT NULL
          )
        ORDER BY x.fecha DESC, x.id DESC
        LIMIT 1
      )

    /*
      Respaldo: motores activos del pozo.
    */
    LEFT JOIN (
      SELECT
        mc.id_pozo,

        MAX(
          CASE
            WHEN NULLIF(mc.cantidad_motores, '') IS NOT NULL
            THEN CAST(REPLACE(mc.cantidad_motores, ',', '.') AS DECIMAL(10,2))
            ELSE NULL
          END
        ) AS cantidad_motores,

        GROUP_CONCAT(DISTINCT NULLIF(mc.marca, '') ORDER BY mc.marca SEPARATOR ' / ') AS marcas_motores,
        GROUP_CONCAT(DISTINCT NULLIF(mc.serial, '') ORDER BY mc.serial SEPARATOR ' / ') AS seriales_motores,
        GROUP_CONCAT(DISTINCT NULLIF(mc.hp, '') ORDER BY mc.hp SEPARATOR ' / ') AS hp_motor,

        CASE
          WHEN MAX(NULLIF(mc.cantidad_motores, '')) IS NOT NULL
            AND MAX(NULLIF(mc.hp, '')) IS NOT NULL
          THEN CONCAT(
            MAX(NULLIF(mc.cantidad_motores, '')),
            ' motor(es) x ',
            MAX(NULLIF(mc.hp, '')),
            ' HP'
          )

          WHEN MAX(NULLIF(mc.cantidad_motores, '')) IS NOT NULL
          THEN CONCAT(MAX(NULLIF(mc.cantidad_motores, '')), ' motor(es)')

          WHEN MAX(NULLIF(mc.hp, '')) IS NOT NULL
          THEN CONCAT(MAX(NULLIF(mc.hp, '')), ' HP')

          ELSE NULL
        END AS configuracion_motor,

        SUM(
          CASE
            WHEN REPLACE(mc.hp, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
              AND REPLACE(mc.cantidad_motores, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
            THEN CAST(REPLACE(mc.hp, ',', '.') AS DECIMAL(10,2))
               * CAST(REPLACE(mc.cantidad_motores, ',', '.') AS DECIMAL(10,2))

            WHEN REPLACE(mc.hp, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
            THEN CAST(REPLACE(mc.hp, ',', '.') AS DECIMAL(10,2))

            ELSE NULL
          END
        ) AS hp_total_motores

      FROM motores_cabezales mc
      WHERE mc.activo = 1
      GROUP BY mc.id_pozo
    ) motores
      ON motores.id_pozo = p.id

    /*
      Respaldo: historial de cabezal instalado actualmente.
    */
    LEFT JOIN (
      SELECT
        ch.id_pozo,

        MAX(
          CASE
            WHEN NULLIF(ch.cantidad_motores, '') IS NOT NULL
            THEN CAST(REPLACE(ch.cantidad_motores, ',', '.') AS DECIMAL(10,2))
            ELSE NULL
          END
        ) AS cantidad_motores,

        GROUP_CONCAT(DISTINCT NULLIF(ch.hp, '') ORDER BY ch.hp SEPARATOR ' / ') AS hp_motor,

        CASE
          WHEN MAX(NULLIF(ch.cantidad_motores, '')) IS NOT NULL
            AND MAX(NULLIF(ch.hp, '')) IS NOT NULL
          THEN CONCAT(
            MAX(NULLIF(ch.cantidad_motores, '')),
            ' motor(es) x ',
            MAX(NULLIF(ch.hp, '')),
            ' HP'
          )

          WHEN MAX(NULLIF(ch.cantidad_motores, '')) IS NOT NULL
          THEN CONCAT(MAX(NULLIF(ch.cantidad_motores, '')), ' motor(es)')

          WHEN MAX(NULLIF(ch.hp, '')) IS NOT NULL
          THEN CONCAT(MAX(NULLIF(ch.hp, '')), ' HP')

          ELSE NULL
        END AS configuracion_motor,

        SUM(
          CASE
            WHEN REPLACE(ch.hp, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
              AND REPLACE(ch.cantidad_motores, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
            THEN CAST(REPLACE(ch.hp, ',', '.') AS DECIMAL(10,2))
               * CAST(REPLACE(ch.cantidad_motores, ',', '.') AS DECIMAL(10,2))

            WHEN REPLACE(ch.hp, ',', '.') REGEXP '^[0-9]+(\\\\.[0-9]+)?$'
            THEN CAST(REPLACE(ch.hp, ',', '.') AS DECIMAL(10,2))

            ELSE NULL
          END
        ) AS hp_total_motores

      FROM cabezal_historial ch
      WHERE ch.fecha_desinstalacion IS NULL
      GROUP BY ch.id_pozo
    ) hist_cabezal
      ON hist_cabezal.id_pozo = p.id

    /*
      Últimas velocidades útiles.
    */
    LEFT JOIN (
      SELECT
        p2.id AS id_pozo,

        (
          SELECT COALESCE(pd.vel_actual, pd.rpm)
          FROM parametros_diarios pd
          WHERE pd.id_pozo = p2.id
            AND COALESCE(pd.vel_actual, pd.rpm) IS NOT NULL
          ORDER BY pd.fecha DESC, pd.id DESC
          LIMIT 1
        ) AS vel_actual,

        (
          SELECT pd.vel_operacional
          FROM parametros_diarios pd
          WHERE pd.id_pozo = p2.id
            AND pd.vel_operacional IS NOT NULL
          ORDER BY pd.fecha DESC, pd.id DESC
          LIMIT 1
        ) AS vel_operacional

      FROM pozos p2
    ) vel
      ON vel.id_pozo = p.id

    WHERE p.id = ?
    LIMIT 1`,
    [pozoId]
  );

  return rows[0] || null;
}


/**
 * Obtiene la bomba actual del pozo.
 *
 * Lógica:
 * - La bomba actual es la bomba más nueva registrada para ese pozo.
 * - Se ordena por fecha_inst DESC.
 * - Si hay empate, se usa id DESC.
 *
 * TVU:
 * - Si tiene fecha_inst y no tiene fecha_falla: hoy - fecha_inst.
 * - Si tiene fecha_inst y fecha_falla: fecha_falla - fecha_inst.
 * - Si no tiene fecha_inst: usa bh.tvu si existe.
 */
async function getBombaActualByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      bh.id,
      bh.id_pozo,
      bh.id_metodo,
      COALESCE(ml.nombre, bh.tipo_bomba_origen) AS metodo,
      bh.marca,
      bh.modelo,
      bh.serial,
      bh.fecha_inst,
      bh.fecha_falla,
      bh.tvu,
      bh.estatus,
      bh.observaciones,

      CASE
        WHEN bh.fecha_inst IS NULL THEN bh.tvu
        WHEN bh.fecha_falla IS NOT NULL THEN DATEDIFF(bh.fecha_falla, bh.fecha_inst)
        ELSE DATEDIFF(CURDATE(), bh.fecha_inst)
      END AS tvu_dias

    FROM bombas_historial bh
    LEFT JOIN metodos_levantamiento ml ON ml.id = bh.id_metodo
    WHERE bh.id_pozo = ?
    ORDER BY
      bh.fecha_inst DESC,
      bh.id DESC
    LIMIT 1`,
    [pozoId]
  );

  return rows[0] || null;
}


/**
 * Obtiene el historial completo de bombas del pozo.
 *
 * TVU:
 * - Históricas con fecha_falla: fecha_falla - fecha_inst.
 * - Activa sin fecha_falla: hoy - fecha_inst.
 */
async function getHistorialBombasByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      bh.id,
      bh.id_pozo,
      bh.id_metodo,
      COALESCE(ml.nombre, bh.tipo_bomba_origen) AS metodo,
      bh.marca,
      bh.modelo,
      bh.serial,
      bh.fecha_inst,
      bh.fecha_falla,
      bh.tvu,
      bh.estatus,
      bh.observaciones,

      CASE
        WHEN bh.fecha_inst IS NULL THEN bh.tvu
        WHEN bh.fecha_falla IS NOT NULL THEN DATEDIFF(bh.fecha_falla, bh.fecha_inst)
        ELSE DATEDIFF(CURDATE(), bh.fecha_inst)
      END AS tvu_dias

    FROM bombas_historial bh
    LEFT JOIN metodos_levantamiento ml ON ml.id = bh.id_metodo
    WHERE bh.id_pozo = ?
    ORDER BY
      bh.fecha_inst DESC,
      bh.id DESC`,
    [pozoId]
  );

  return rows;
}

/**
 * Último registro de parámetros diarios del pozo.
 *
 * Importante:
 * - vel_operacional viene de V.O (RPM) del Master.
 * - vel_actual viene de VELOCIDAD (RPM) del Master.
 *
 * La ficha del pozo usa estos valores como velocidades vigentes.
 */
async function getUltimoParametroByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      id,
      id_pozo,
      fecha,

      freq,
      volts,
      amp,

      vel_operacional,
      vel_actual,
      rpm,

      torque,
      presion_casing,
      presion_tubing,

      hp,

      observacion,
      diagnostico,

      recomendacion,
      recomendaciones,
      ajustes_realizados,
      comentario,

      CONCAT_WS(
        ' | ',
        NULLIF(recomendaciones, ''),
        NULLIF(ajustes_realizados, ''),
        NULLIF(comentario, ''),
        NULLIF(recomendacion, '')
      ) AS recomendaciones_completas

    FROM parametros_diarios
    WHERE id_pozo = ?
    ORDER BY fecha DESC, id DESC
    LIMIT 1`,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Última toma de nivel del pozo.
 */
async function getUltimoNivelByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      id,
      id_pozo,
      fecha,
      nf_pies,
      sumergencia,
      pip,
      pbhp,
      presion_casing,
      diagnostico
    FROM tomas_nivel
    WHERE id_pozo = ?
    ORDER BY fecha DESC, id DESC
    LIMIT 1`,
    [pozoId]
  );

  return rows[0] || null;
}

/**
 * Últimas muestras del pozo.
 * 
 * Esto alimenta la tabla inicial del tab de muestras.
 */
async function getUltimasMuestrasByPozo(id, limit = 10) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
      id,
      id_pozo,
      fecha,
      ays,
      api,
      representativa,
      prox_muestra
    FROM muestras_fluido
    WHERE id_pozo = ?
    ORDER BY fecha DESC, id DESC
    LIMIT ?`,
    [pozoId, Number(limit)]
  );

  return rows;
}



/**
 * Datos base para cache/offline/PWA.
 * 
 * Esta función puede servir luego para guardar un paquete inicial
 * de datos en IndexedDB o local cache.
 */
async function getBootstrapData() {
  const [[pozos], [bombas], [parametrosDiarios], [niveles], [muestras]] = await Promise.all([
    pool.query(`
      SELECT id, codigo, area, categoria, color_estado_mapa
      FROM pozos
      ORDER BY codigo ASC
      LIMIT 100
    `),
    pool.query(`
      SELECT id, id_pozo, marca, modelo, fecha_inst, estatus
      FROM bombas_historial
      ORDER BY fecha_inst DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT id, id_pozo, fecha, torque, amp, freq, rpm, hp
      FROM parametros_diarios
      ORDER BY fecha DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT id, id_pozo, fecha, nf_pies, sumergencia, pip, pbhp
      FROM tomas_nivel
      ORDER BY fecha DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT id, id_pozo, fecha, ays, api, prox_muestra
      FROM muestras_fluido
      ORDER BY fecha DESC
      LIMIT 100
    `)
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




/**
 * Timeline compacto del pozo.
 *
 * Se usa para mostrar los últimos registros relacionados al pozo:
 * - Parámetros diarios
 * - Tomas de nivel
 * - Muestras de fluido
 * - Servicios programados
 */
async function getPozoTimeline(id) {
  const pozoId = Number(id);

 const [parametros] = await pool.query(
  `SELECT
     id,
     id_pozo,
     fecha,

     freq,
     volts,
     amp,

     vel_operacional,
     vel_actual,
     rpm,

     torque,
     presion_casing,
     presion_tubing,

     hp,

     observacion,
     diagnostico,

     recomendacion,
     recomendaciones,
     ajustes_realizados,
     comentario,

     CONCAT_WS(
       ' | ',
       NULLIF(recomendaciones, ''),
       NULLIF(ajustes_realizados, ''),
       NULLIF(comentario, ''),
       NULLIF(recomendacion, '')
     ) AS recomendaciones_completas

   FROM parametros_diarios
   WHERE id_pozo = ?
   ORDER BY fecha DESC, id DESC
   LIMIT 100`,
  [pozoId]
);



  const [niveles] = await pool.query(
    `SELECT
       fecha,
       nf_pies,
       sumergencia,
       pip,
       pbhp,
       presion_casing,
       diagnostico
     FROM tomas_nivel
     WHERE id_pozo = ?
     ORDER BY fecha DESC, id DESC
     LIMIT 10`,
    [pozoId]
  );

  const [muestras] = await pool.query(
    `SELECT
       fecha,
       ays,
       api,
       representativa,
       prox_muestra
     FROM muestras_fluido
     WHERE id_pozo = ?
     ORDER BY fecha DESC, id DESC
     LIMIT 10`,
    [pozoId]
  );

  const [servicios] = await pool.query(
    `SELECT
       sp.fecha_est,
       sp.tipo_servicio,
       sp.prioridad,
       sp.estatus_prog,
       us.nombre AS unidad
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

/**
 * Obtiene el survey activo del pozo.
 *
 * La tabla pozo_survey debe guardar:
 * - MD
 * - TVD
 * - x_offset
 * - y_offset
 * - delta_x
 * - delta_y
 * - azimut
 */
async function getSurveyActivoByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
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
      activo,
      created_at,
      updated_at
    FROM pozo_survey
    WHERE id_pozo = ?
      AND activo = 1
    ORDER BY fila_orden ASC, id ASC`,
    [pozoId]
  );

  return rows;
}
function normalizeSurveyHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/\./g, '')
    .replace(/[()]/g, '')
    .replace(/__+/g, '_');
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;

  const clean = String(value)
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  if (!clean) return null;

  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

/**
 * Recibe texto pegado desde Excel y lo convierte en filas normalizadas.
 *
 * Espera columnas:
 * - MD
 * - TVD
 * - x-offset
 * - y-offset
 */
function parseSurveyPastedText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Debes pegar al menos una fila de encabezados y una fila de datos.');
  }

  const headers = lines[0].split(/\t|;|,/).map(normalizeSurveyHeader);

  const findIndex = (...names) => {
    return headers.findIndex((header) => names.includes(header));
  };

  const mdIndex = findIndex('md', 'measured_depth');
  const tvdIndex = findIndex('tvd');
  const xIndex = findIndex('x_offset', 'xoffset', 'x', 'x_off_set');
  const yIndex = findIndex('y_offset', 'yoffset', 'y', 'y_off_set');

  if (mdIndex === -1 || tvdIndex === -1 || xIndex === -1 || yIndex === -1) {
    throw new Error('La tabla debe contener columnas MD, TVD, x-offset y y-offset.');
  }

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(/\t|;|,/);

    const md = parseNumber(cells[mdIndex]);
    const tvd = parseNumber(cells[tvdIndex]);
    const x_offset = parseNumber(cells[xIndex]);
    const y_offset = parseNumber(cells[yIndex]);

    const isEmptyRow =
      md === null &&
      tvd === null &&
      x_offset === null &&
      y_offset === null;

    if (isEmptyRow) continue;

    rows.push({
      md,
      tvd,
      x_offset,
      y_offset,
      raw: {
        source_line: lines[i],
        cells
      }
    });
  }

  if (!rows.length) {
    throw new Error('No se encontraron filas válidas en el survey pegado.');
  }

  return rows;
}
/**
 * Reemplaza el survey activo de un pozo.
 *
 * Flujo:
 * 1. Parsea texto pegado desde Excel.
 * 2. Calcula delta_x, delta_y y azimut.
 * 3. Desactiva survey anterior.
 * 4. Inserta el nuevo survey como activo.
 */
async function replaceSurveyActivoByPozo(id, pastedText) {
  const pozoId = Number(id);
  const parsedRows = parseSurveyPastedText(pastedText);
  const calculatedRows = calcularSurvey(parsedRows);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE pozo_survey
       SET activo = 0,
           updated_at = NOW()
       WHERE id_pozo = ?
         AND activo = 1`,
      [pozoId]
    );

    const loteCarga = `SURVEY_${pozoId}_${Date.now()}`;

    const values = calculatedRows.map((row) => [
      pozoId,
      row.fila_orden,
      row.md,
      row.tvd,
      row.x_offset,
      row.y_offset,
      row.delta_x,
      row.delta_y,
      row.azimut,
      loteCarga,
      row.raw_payload,
      1
    ]);

    await conn.query(
      `INSERT INTO pozo_survey (
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
        activo
      )
      VALUES ?`,
      [values]
    );

    await conn.commit();

    return {
      loteCarga,
      totalRows: calculatedRows.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getSurveyActivoByPozo(id) {
  const pozoId = Number(id);

  const [rows] = await pool.query(
    `SELECT
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
      activo,
      created_at,
      updated_at
    FROM pozo_survey
    WHERE id_pozo = ?
      AND activo = 1
    ORDER BY fila_orden ASC, id ASC`,
    [pozoId]
  );

  return rows;
}

function normalizeSurveyHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/\./g, '')
    .replace(/[()]/g, '')
    .replace(/__+/g, '_');
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;

  const clean = String(value)
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  if (!clean) return null;

  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function parseSurveyPastedText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Debes pegar al menos una fila de encabezados y una fila de datos.');
  }

  const headers = lines[0].split(/\t|;|,/).map(normalizeSurveyHeader);

  const findIndex = (...names) => headers.findIndex((header) => names.includes(header));

  const mdIndex = findIndex('md', 'measured_depth');
  const tvdIndex = findIndex('tvd');
  const xIndex = findIndex('x_offset', 'xoffset', 'x', 'x_off_set');
  const yIndex = findIndex('y_offset', 'yoffset', 'y', 'y_off_set');

  if (mdIndex === -1 || tvdIndex === -1 || xIndex === -1 || yIndex === -1) {
    throw new Error('La tabla debe contener columnas MD, TVD, x-offset y y-offset.');
  }

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(/\t|;|,/);

    const md = parseNumber(cells[mdIndex]);
    const tvd = parseNumber(cells[tvdIndex]);
    const x_offset = parseNumber(cells[xIndex]);
    const y_offset = parseNumber(cells[yIndex]);

    const isEmptyRow = md === null && tvd === null && x_offset === null && y_offset === null;

    if (isEmptyRow) continue;

    rows.push({
      md,
      tvd,
      x_offset,
      y_offset,
      raw: {
        source_line: lines[i],
        cells
      }
    });
  }

  if (!rows.length) {
    throw new Error('No se encontraron filas válidas en el survey pegado.');
  }

  return rows;
}

function calcularSurvey(rows) {
  return rows.map((row, index) => {
    let deltaX = null;
    let deltaY = null;
    let azimut = null;

    if (index > 0) {
      const previous = rows[index - 1];

      if (
        Number.isFinite(Number(row.x_offset)) &&
        Number.isFinite(Number(row.y_offset)) &&
        Number.isFinite(Number(previous.x_offset)) &&
        Number.isFinite(Number(previous.y_offset))
      ) {
        deltaX = Number(row.x_offset) - Number(previous.x_offset);
        deltaY = Number(row.y_offset) - Number(previous.y_offset);

        const degrees = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        azimut = ((degrees % 360) + 360) % 360;
      }
    }

    return {
      fila_orden: index + 1,
      md: row.md,
      tvd: row.tvd,
      x_offset: row.x_offset,
      y_offset: row.y_offset,
      delta_x: deltaX,
      delta_y: deltaY,
      azimut: azimut !== null ? Number(azimut.toFixed(2)) : null,
      raw_payload: JSON.stringify(row.raw || {})
    };
  });
}

async function replaceSurveyActivoByPozo(id, pastedText) {
  const pozoId = Number(id);
  const parsedRows = parseSurveyPastedText(pastedText);
  const calculatedRows = calcularSurvey(parsedRows);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE pozo_survey
       SET activo = 0,
           updated_at = NOW()
       WHERE id_pozo = ?
         AND activo = 1`,
      [pozoId]
    );

    const loteCarga = `SURVEY_${pozoId}_${Date.now()}`;

    const values = calculatedRows.map((row) => [
      pozoId,
      row.fila_orden,
      row.md,
      row.tvd,
      row.x_offset,
      row.y_offset,
      row.delta_x,
      row.delta_y,
      row.azimut,
      loteCarga,
      row.raw_payload,
      1
    ]);

    await conn.query(
      `INSERT INTO pozo_survey (
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
        activo
      )
      VALUES ?`,
      [values]
    );

    await conn.commit();

    return {
      loteCarga,
      totalRows: calculatedRows.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updatePozoPotencial(id, potencial) {
  const pozoId = Number(id);

  if (!Number.isInteger(pozoId) || pozoId <= 0) {
    throw new Error('ID de pozo inválido.');
  }

  const potencialNumber =
    potencial === null || potencial === undefined || String(potencial).trim() === ''
      ? null
      : Number(String(potencial).replace(',', '.'));

  if (potencialNumber !== null && !Number.isFinite(potencialNumber)) {
    throw new Error('El potencial debe ser un número válido.');
  }

  if (potencialNumber !== null && potencialNumber < 0) {
    throw new Error('El potencial no puede ser negativo.');
  }

  const [result] = await pool.query(
    `UPDATE pozos
     SET potencial = ?
     WHERE id = ?`,
    [potencialNumber, pozoId]
  );

  return {
    affectedRows: result.affectedRows,
    potencial: potencialNumber
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
  getUltimasMuestrasByPozo,
  getPozoTimeline,
  getBootstrapData,
  getSurveyActivoByPozo,
replaceSurveyActivoByPozo,
updatePozoPotencial
};