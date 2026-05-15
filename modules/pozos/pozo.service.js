const { pool } = require('../../config/db');

const POZO_SERVICE_VERSION = 'pozo.service.ficha-equipos-comparativo-niveles-2026-05-14-v6';

console.log(`[POZO_SERVICE] cargado: ${POZO_SERVICE_VERSION}`);
console.log('[POZO_SERVICE] archivo:', __filename);

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
 * Cache simple para no consultar INFORMATION_SCHEMA en cada request.
 */
const columnsCache = new Map();

/**
 * Verifica columnas existentes en una tabla/vista.
 */
async function getExistingColumns(tableName) {
  if (columnsCache.has(tableName)) {
    return columnsCache.get(tableName);
  }

  const rows = await query(
    `
    SELECT COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const columns = new Set(rows.map((row) => row.column_name));
  columnsCache.set(tableName, columns);

  return columns;
}

/**
 * Arma un SELECT seguro según columnas existentes.
 */
function buildSafeSelect(columnsSet, requestedColumns) {
  return requestedColumns
    .map((column) => {
      if (typeof column === 'string') {
        return columnsSet.has(column) ? column : `NULL AS ${column}`;
      }

      if (column && typeof column === 'object') {
        const source = column.source;
        const alias = column.alias || source;

        return columnsSet.has(source) ? `${source} AS ${alias}` : `NULL AS ${alias}`;
      }

      return null;
    })
    .filter(Boolean)
    .join(',\n      ');
}

/**
 * Añade campos calculados que antes se hacían en SQL con COALESCE.
 */
function normalizeParametroRow(row) {
  if (!row) return row;

  return {
    ...row,
    recomendaciones_completas:
      row.recomendaciones ||
      row.recomendacion ||
      row.comentario ||
      row.observacion ||
      null
  };
}

function normalizeParametroRows(rows) {
  return rows.map(normalizeParametroRow);
}

/**
 * Listado principal de pozos.
 *
 * Versión blindada:
 * - La tabla principal es SOLO pozos p.
 * - No hay JOIN contra catálogos ni vistas en el listado.
 * - Todo lo auxiliar se obtiene con subconsultas escalares LIMIT 1.
 * - Así /pozos/data no puede multiplicar filas.
 */
async function listPozos(filters = {}) {
  const where = [];
  const params = [];

  const [
    pozosColumns,
    estadoColumns,
    parametrosColumns,
    vdfsColumns,
    cabezalesColumns,
    metodosColumns,
    bombasColumns
  ] = await Promise.all([
    getExistingColumns('pozos'),
    getExistingColumns('estado_pozo'),
    getExistingColumns('parametros_diarios'),
    getExistingColumns('vdfs'),
    getExistingColumns('cabezales'),
    getExistingColumns('metodos_levantamiento'),
    getExistingColumns('bombas_historial')
  ]);

  const pIdEstado = pozosColumns.has('id_estado') ? 'p.id_estado' : 'NULL';
  const pIdMetodo = pozosColumns.has('id_metodo') ? 'p.id_metodo' : 'NULL';
  const pIdCabezal = pozosColumns.has('id_cabezal') ? 'p.id_cabezal' : 'NULL';
  const pIdVdf = pozosColumns.has('id_vdf') ? 'p.id_vdf' : 'NULL';

  const pColorEstado = pozosColumns.has('color_estado_mapa')
    ? 'p.color_estado_mapa'
    : 'NULL';

  const pVelActual = pozosColumns.has('vel_actual')
    ? 'p.vel_actual'
    : 'NULL';

  const pVelOperacional = pozosColumns.has('vel_operacional')
    ? 'p.vel_operacional'
    : 'NULL';

  const pFechaArranque = pozosColumns.has('fecha_arranque')
    ? 'p.fecha_arranque'
    : 'NULL';

  const estadoNombreExpr = estadoColumns.has('nombre')
    ? `
      (
        SELECT ep.nombre
        FROM estado_pozo ep
        WHERE ep.id = ${pIdEstado}
          AND ep.nombre IS NOT NULL
          AND ep.nombre <> ''
        ORDER BY ep.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const estadoColorCandidates = [];

  if (estadoColumns.has('color_estado_mapa')) {
    estadoColorCandidates.push('NULLIF(ep.color_estado_mapa, \'\')');
  }

  if (estadoColumns.has('color_mapa')) {
    estadoColorCandidates.push('NULLIF(ep.color_mapa, \'\')');
  }

  if (estadoColumns.has('color_hex')) {
    estadoColorCandidates.push('NULLIF(ep.color_hex, \'\')');
  }

  if (estadoColumns.has('color')) {
    estadoColorCandidates.push('NULLIF(ep.color, \'\')');
  }

  const estadoColorExpr = estadoColorCandidates.length
    ? `
      (
        SELECT COALESCE(${estadoColorCandidates.join(', ')})
        FROM estado_pozo ep
        WHERE ep.id = ${pIdEstado}
        ORDER BY ep.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const metodoNombreExpr = metodosColumns.has('nombre')
    ? `
      (
        SELECT ml.nombre
        FROM metodos_levantamiento ml
        WHERE ml.id = ${pIdMetodo}
          AND ml.nombre IS NOT NULL
          AND ml.nombre <> ''
        ORDER BY ml.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const cabezalCandidates = [];

  if (cabezalesColumns.has('nombre')) {
    cabezalCandidates.push('NULLIF(cb.nombre, \'\')');
  }

  if (cabezalesColumns.has('marca')) {
    cabezalCandidates.push('NULLIF(cb.marca, \'\')');
  }

  if (cabezalesColumns.has('modelo')) {
    cabezalCandidates.push('NULLIF(cb.modelo, \'\')');
  }

  const cabezalExpr = cabezalCandidates.length
    ? `
      (
        SELECT COALESCE(${cabezalCandidates.join(', ')})
        FROM cabezales cb
        WHERE cb.id = ${pIdCabezal}
        ORDER BY cb.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const variadorCandidates = [];

  if (vdfsColumns.has('marca')) {
    variadorCandidates.push('NULLIF(vd.marca, \'\')');
  }

  if (vdfsColumns.has('nombre')) {
    variadorCandidates.push('NULLIF(vd.nombre, \'\')');
  }

  if (vdfsColumns.has('modelo')) {
    variadorCandidates.push('NULLIF(vd.modelo, \'\')');
  }

  const variadorExpr = variadorCandidates.length
    ? `
      (
        SELECT COALESCE(${variadorCandidates.join(', ')})
        FROM vdfs vd
        WHERE vd.id = ${pIdVdf}
        ORDER BY vd.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const variadorModeloExpr = vdfsColumns.has('modelo')
    ? `
      (
        SELECT vd.modelo
        FROM vdfs vd
        WHERE vd.id = ${pIdVdf}
          AND vd.modelo IS NOT NULL
          AND vd.modelo <> ''
        ORDER BY vd.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const variadorCapacidadExpr = vdfsColumns.has('capacidad')
    ? `
      (
        SELECT vd.capacidad
        FROM vdfs vd
        WHERE vd.id = ${pIdVdf}
          AND vd.capacidad IS NOT NULL
          AND vd.capacidad <> ''
        ORDER BY vd.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const variadorPotenciaExpr = vdfsColumns.has('potencia_hp')
    ? `
      (
        SELECT vd.potencia_hp
        FROM vdfs vd
        WHERE vd.id = ${pIdVdf}
          AND vd.potencia_hp IS NOT NULL
        ORDER BY vd.id ASC
        LIMIT 1
      )
    `
    : vdfsColumns.has('hp')
      ? `
        (
          SELECT vd.hp
          FROM vdfs vd
          WHERE vd.id = ${pIdVdf}
            AND vd.hp IS NOT NULL
          ORDER BY vd.id ASC
          LIMIT 1
        )
      `
      : 'NULL';

  const pdFechaOrder = parametrosColumns.has('fecha') ? 'pd.fecha DESC,' : '';
  const pdIdOrder = parametrosColumns.has('id') ? 'pd.id DESC' : 'pd.id_pozo DESC';

  const pdVelActualExpr = parametrosColumns.has('vel_actual')
    ? `
      (
        SELECT pd.vel_actual
        FROM parametros_diarios pd
        WHERE pd.id_pozo = p.id
          AND pd.vel_actual IS NOT NULL
        ORDER BY ${pdFechaOrder} ${pdIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const pdVelOperacionalExpr = parametrosColumns.has('vel_operacional')
    ? `
      (
        SELECT pd.vel_operacional
        FROM parametros_diarios pd
        WHERE pd.id_pozo = p.id
          AND pd.vel_operacional IS NOT NULL
        ORDER BY ${pdFechaOrder} ${pdIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const pdRpmExpr = parametrosColumns.has('rpm')
    ? `
      (
        SELECT pd.rpm
        FROM parametros_diarios pd
        WHERE pd.id_pozo = p.id
          AND pd.rpm IS NOT NULL
        ORDER BY ${pdFechaOrder} ${pdIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const pdFechaExpr = parametrosColumns.has('fecha')
    ? `
      (
        SELECT pd.fecha
        FROM parametros_diarios pd
        WHERE pd.id_pozo = p.id
          AND (
            ${[
              parametrosColumns.has('vel_actual') ? 'pd.vel_actual IS NOT NULL' : null,
              parametrosColumns.has('vel_operacional') ? 'pd.vel_operacional IS NOT NULL' : null,
              parametrosColumns.has('rpm') ? 'pd.rpm IS NOT NULL' : null
            ].filter(Boolean).join(' OR ') || '1 = 0'}
          )
        ORDER BY ${pdFechaOrder} ${pdIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const bhFechaOrder = bombasColumns.has('fecha_inst') ? 'bh.fecha_inst DESC,' : '';
  const bhIdOrder = bombasColumns.has('id') ? 'bh.id DESC' : 'bh.id_pozo DESC';

  const bombaMarcaExpr = bombasColumns.has('marca')
    ? `
      (
        SELECT bh.marca
        FROM bombas_historial bh
        WHERE bh.id_pozo = p.id
          AND bh.marca IS NOT NULL
          AND bh.marca <> ''
        ORDER BY ${bhFechaOrder} ${bhIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const bombaModeloExpr = bombasColumns.has('modelo')
    ? `
      (
        SELECT bh.modelo
        FROM bombas_historial bh
        WHERE bh.id_pozo = p.id
          AND bh.modelo IS NOT NULL
          AND bh.modelo <> ''
        ORDER BY ${bhFechaOrder} ${bhIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const bombaSerialExpr = bombasColumns.has('serial')
    ? `
      (
        SELECT bh.serial
        FROM bombas_historial bh
        WHERE bh.id_pozo = p.id
          AND bh.serial IS NOT NULL
          AND bh.serial <> ''
        ORDER BY ${bhFechaOrder} ${bhIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const bombaFechaInstExpr = bombasColumns.has('fecha_inst')
    ? `
      (
        SELECT bh.fecha_inst
        FROM bombas_historial bh
        WHERE bh.id_pozo = p.id
          AND bh.fecha_inst IS NOT NULL
        ORDER BY ${bhFechaOrder} ${bhIdOrder}
        LIMIT 1
      )
    `
    : 'NULL';

  const estadoForSearch = `COALESCE(${estadoNombreExpr}, 'Sin estado')`;

  if (filters.search) {
    where.push(`
      (
        p.codigo LIKE ?
        OR p.area LIKE ?
        OR p.yacimiento LIKE ?
        OR ${estadoForSearch} LIKE ?
        OR ${cabezalExpr} LIKE ?
        OR ${variadorExpr} LIKE ?
        OR ${metodoNombreExpr} LIKE ?
      )
    `);

    const search = like(filters.search);
    params.push(search, search, search, search, search, search, search);
  }

  if (filters.area) {
    where.push('p.area = ?');
    params.push(filters.area);
  }

  if (filters.estado) {
    where.push(`${estadoForSearch} = ?`);
    params.push(filters.estado);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return query(
    `
    SELECT
      p.id,
      p.codigo,
      NULL AS nombre,
      p.categoria,
      p.area,
      NULL AS zona,
      p.yacimiento,
      p.potencial,
      p.latitud,
      p.longitud,

      NULL AS coord_x,
      NULL AS coord_y,
      NULL AS diagrama,
      NULL AS visible,
      NULL AS vista_mapa,
      NULL AS vista_diagrama,

      ${pFechaArranque} AS fecha_arranque,

      CASE
        WHEN LOWER(${estadoForSearch}) LIKE '%candidato%' THEN '#ef4444'
        WHEN LOWER(${estadoForSearch}) = 'en servicio' THEN '#f59e0b'
        WHEN LOWER(${estadoForSearch}) LIKE '%espera%' THEN '#64748b'
        WHEN LOWER(${estadoForSearch}) LIKE '%diferido%' THEN '#ef4444'
        WHEN LOWER(${estadoForSearch}) LIKE '%diagn%' THEN '#9333ea'
        WHEN LOWER(${estadoForSearch}) LIKE '%activo%' THEN '#22c55e'
        ELSE COALESCE(${pColorEstado}, ${estadoColorExpr}, '#033F73')
      END AS color_estado_mapa,

      CASE
        WHEN LOWER(${estadoForSearch}) LIKE '%candidato%' THEN '#ef4444'
        WHEN LOWER(${estadoForSearch}) = 'en servicio' THEN '#f59e0b'
        WHEN LOWER(${estadoForSearch}) LIKE '%espera%' THEN '#64748b'
        WHEN LOWER(${estadoForSearch}) LIKE '%diferido%' THEN '#ef4444'
        WHEN LOWER(${estadoForSearch}) LIKE '%diagn%' THEN '#9333ea'
        WHEN LOWER(${estadoForSearch}) LIKE '%activo%' THEN '#22c55e'
        ELSE COALESCE(${pColorEstado}, ${estadoColorExpr}, '#033F73')
      END AS estado_color,

      COALESCE(${pVelActual}, ${pdVelActualExpr}, ${pdRpmExpr}) AS vel_actual,
      COALESCE(${pVelActual}, ${pdVelActualExpr}, ${pdRpmExpr}) AS velocidad_actual,
      COALESCE(${pVelActual}, ${pdVelActualExpr}, ${pdRpmExpr}) AS rpm,

      COALESCE(${pVelOperacional}, ${pdVelOperacionalExpr}) AS vel_operacional,
      COALESCE(${pVelOperacional}, ${pdVelOperacionalExpr}) AS velocidad_operacional,

      NULL AS alto_corte_agua,
      NULL AS nota_operativa,
      NULL AS causa_diferido,

      ${estadoForSearch} AS estado,
      ${cabezalExpr} AS cabezal,
      ${variadorExpr} AS variador,
      ${variadorModeloExpr} AS variador_modelo,
      ${variadorCapacidadExpr} AS variador_capacidad,
      ${variadorPotenciaExpr} AS variador_potencia_hp,
      ${metodoNombreExpr} AS metodo_levantamiento,

      ${bombaMarcaExpr} AS bomba_marca,
      ${bombaModeloExpr} AS bomba_modelo,
      ${bombaSerialExpr} AS serial_rotor,
      NULL AS serial_estator,
      ${bombaFechaInstExpr} AS bomba_fecha_instalacion,
      CASE
        WHEN ${bombaFechaInstExpr} IS NOT NULL
          THEN DATEDIFF(CURDATE(), ${bombaFechaInstExpr})
        ELSE NULL
      END AS bomba_tvu_dias,

      ${pdFechaExpr} AS ultima_parametrizacion,
      NULL AS ultimo_nivel,
      NULL AS ultima_muestra,
      NULL AS prox_muestra,
      NULL AS servicio_asignado,
      NULL AS tipo_servicio,
      NULL AS subtipo_servicio

    FROM pozos p

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
  return {
    areas: await getAreasOptions(),
    estados: await getEstadosOptions()
  };
}

async function getAreasOptions() {
  const rows = await query(`
    SELECT DISTINCT
      area
    FROM pozos
    WHERE area IS NOT NULL
      AND area <> ''
    ORDER BY area ASC
  `);

  return rows.map((row) => row.area).filter(Boolean);
}

async function getEstadosOptions() {
  const pozosColumns = await getExistingColumns('pozos');
  const estadoColumns = await getExistingColumns('estado_pozo');

  const pIdEstado = pozosColumns.has('id_estado') ? 'p.id_estado' : 'NULL';

  const estadoNombreExpr = estadoColumns.has('nombre')
    ? `
      (
        SELECT ep.nombre
        FROM estado_pozo ep
        WHERE ep.id = ${pIdEstado}
          AND ep.nombre IS NOT NULL
          AND ep.nombre <> ''
        ORDER BY ep.id ASC
        LIMIT 1
      )
    `
    : 'NULL';

  const rows = await query(`
    SELECT DISTINCT
      COALESCE(${estadoNombreExpr}, 'Sin estado') AS estado
    FROM pozos p
    WHERE COALESCE(${estadoNombreExpr}, '') <> ''
    ORDER BY estado ASC
  `);

  return rows.map((row) => row.estado).filter(Boolean);
}

/**
 * Detalle base del pozo.
 *
 * Se usa la vista como base, pero se enriquece con:
 * - pozo_equipos_actuales
 * - vdfs
 * - cabezales
 * - motores_cabezales
 */
async function getPozoById(id) {
  const rows = await query(
    `
    SELECT
      v.*
    FROM vw_pozo_ficha_general v
    WHERE v.id = ?
      OR v.codigo = ?
    LIMIT 1
    `,
    [id, id]
  );

  const pozoBase = rows[0] || null;

  if (!pozoBase) return null;

  const pozoIds = await getPozoEquipmentIds(pozoBase.id);

  const [
    equipoActual,
    variadorCatalogo,
    cabezalCatalogo,
    motoresCabezal
  ] = await Promise.all([
    getEquipoActualPozo(pozoBase.id),
    getVariadorCatalogo(pozoIds.id_vdf),
    getCabezalCatalogo(pozoIds.id_cabezal),
    getMotoresCabezalActuales(pozoBase.id)
  ]);

  return normalizePozoFicha({
    ...pozoBase,

    id_vdf: pozoIds.id_vdf,
    id_cabezal: pozoIds.id_cabezal,

    equipo_actual_fecha: equipoActual?.fecha_referencia || null,

    variador_nombre_original: equipoActual?.variador_nombre_original || null,
    variador_capacidad_hp: equipoActual?.variador_capacidad_hp || null,
    variador_capacidad_kva: equipoActual?.variador_capacidad_kva || null,

    cabezal_nombre_original: equipoActual?.cabezal_nombre_original || null,
    cabezal_hp_total: equipoActual?.cabezal_hp_total || null,
    cabezal_hp_motor: equipoActual?.cabezal_hp_motor || null,
    cabezal_cantidad_motores: equipoActual?.cabezal_cantidad_motores || null,
    cabezal_configuracion_motor: equipoActual?.cabezal_configuracion_motor || null,

    variador_catalogo_nombre:
      variadorCatalogo?.nombre ||
      variadorCatalogo?.marca ||
      variadorCatalogo?.modelo ||
      null,
    variador_catalogo_marca: variadorCatalogo?.marca || null,
    variador_catalogo_modelo: variadorCatalogo?.modelo || null,
    variador_catalogo_capacidad: variadorCatalogo?.capacidad || null,
    variador_catalogo_potencia_hp:
      variadorCatalogo?.potencia_hp ||
      variadorCatalogo?.hp ||
      null,

    cabezal_catalogo_nombre:
      cabezalCatalogo?.nombre ||
      cabezalCatalogo?.marca ||
      cabezalCatalogo?.modelo ||
      null,
    cabezal_catalogo_marca: cabezalCatalogo?.marca || null,
    cabezal_catalogo_modelo: cabezalCatalogo?.modelo || null,
    cabezal_catalogo_hp: cabezalCatalogo?.hp || null,
    cabezal_catalogo_potencia_motor: cabezalCatalogo?.potencia_motor || null,

    motores_cabezal_configuracion: motoresCabezal?.configuracion_motor || null
  });
}

/**
 * Bomba vigente del pozo.
 *
 * Regla TVU:
 * - Si la bomba no tiene fecha_falla, el TVU se calcula contra CURDATE().
 * - Si la bomba tiene fecha_falla, el TVU queda fijo hasta la fecha de falla.
 * - Para pozos activos, se prioriza la última bomba sin fecha_falla.
 */
async function getBombaActualByPozo(pozoId) {
  const rows = await query(
    `
    SELECT
      b.id,
      b.id_pozo,
      p.codigo,
      p.categoria,
      ep.nombre AS estado_pozo,

      ml.nombre AS metodo,

      b.marca,
      b.modelo,
      b.serial,
      b.serial AS serial_rotor,
      NULL AS serial_estator,

      b.fecha_inst,
      b.fecha_falla,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN b.fecha_inst > CURDATE() THEN 0
        WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
        ELSE DATEDIFF(CURDATE(), b.fecha_inst)
      END AS tvu,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN b.fecha_inst > CURDATE() THEN 0
        WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
        ELSE DATEDIFF(CURDATE(), b.fecha_inst)
      END AS tvu_dias,

      b.estatus,
      b.observaciones,

      CASE
        WHEN b.fecha_falla IS NULL THEN 'BOMBAS_HISTORIAL_ACTIVA'
        ELSE 'BOMBAS_HISTORIAL_FALLADA'
      END AS fuente_actual

    FROM bombas_historial b
    INNER JOIN pozos p
      ON p.id = b.id_pozo
    LEFT JOIN estado_pozo ep
      ON ep.id = p.id_estado
    LEFT JOIN metodos_levantamiento ml
      ON ml.id = b.id_metodo

    WHERE b.id_pozo = ?
      AND b.fecha_inst IS NOT NULL

    ORDER BY
      CASE WHEN b.fecha_falla IS NULL THEN 0 ELSE 1 END ASC,
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
 *
 * TVU calculado dinámicamente:
 * - Si fecha_falla existe: fecha_falla - fecha_inst.
 * - Si fecha_falla no existe: CURDATE() - fecha_inst.
 */
async function getHistorialBombasByPozo(pozoId) {
  return query(
    `
    SELECT
      b.id_pozo,
      p.codigo,
      b.id,

      ml.nombre AS metodo,

      b.marca,
      b.modelo,
      b.serial,
      b.serial AS serial_rotor,
      NULL AS serial_estator,

      b.fecha_inst,
      b.fecha_falla,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN b.fecha_inst > CURDATE() THEN 0
        WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
        ELSE DATEDIFF(CURDATE(), b.fecha_inst)
      END AS tvu,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN b.fecha_inst > CURDATE() THEN 0
        WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
        ELSE DATEDIFF(CURDATE(), b.fecha_inst)
      END AS tvu_dias,

      b.estatus,
      b.observaciones

    FROM bombas_historial b
    INNER JOIN pozos p
      ON p.id = b.id_pozo
    LEFT JOIN metodos_levantamiento ml
      ON ml.id = b.id_metodo

    WHERE b.id_pozo = ?

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
  const columns = await getExistingColumns('parametros_diarios');

  const selectSql = buildSafeSelect(columns, [
    'id',
    'uuid_local',
    'id_pozo',
    'fecha',
    'torque',
    'amp',
    'freq',
    'volts',
    'rpm',
    'hp',
    'vel_operacional',
    'vel_actual',
    'pip',
    'pbhp',
    'presion_casing',
    'presion_tubing',
    'nf_pies',
    'porcentaje_liq',
    'diagnostico',
    'recomendacion',
    'recomendaciones',
    'ajustes_realizados',
    'comentario',
    'observacion',
    'sync_status',
    'id_personal',
    'id_usuario_carga'
  ]);

  const rows = await query(
    `
    SELECT
      ${selectSql}
    FROM parametros_diarios
    WHERE id_pozo = ?
    ORDER BY
      fecha DESC,
      id DESC
    LIMIT 1
    `,
    [pozoId]
  );

  return normalizeParametroRow(rows[0] || null);
}

/**
 * Último nivel.
 */
async function getUltimoNivelByPozo(pozoId) {
  const rows = await query(
    `
    SELECT
      *
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
 */
async function getHistorialParametrosByPozo(pozoId) {
  const columns = await getExistingColumns('parametros_diarios');

  const selectSql = buildSafeSelect(columns, [
    'id',
    'uuid_local',
    'id_pozo',
    'fecha',
    'torque',
    'amp',
    'freq',
    'volts',
    'rpm',
    'hp',
    'vel_operacional',
    'vel_actual',
    'pip',
    'pbhp',
    'presion_casing',
    'presion_tubing',
    'nf_pies',
    'porcentaje_liq',
    'diagnostico',
    'recomendacion',
    'recomendaciones',
    'ajustes_realizados',
    'comentario',
    'observacion',
    'sync_status',
    'id_personal',
    'id_usuario_carga'
  ]);

  const rows = await query(
    `
    SELECT
      ${selectSql}
    FROM parametros_diarios
    WHERE id_pozo = ?
    ORDER BY
      fecha DESC,
      id DESC
    `,
    [pozoId]
  );

  return normalizeParametroRows(rows);
}

/**
 * Histórico de niveles.
 */
async function getHistorialNivelesByPozo(pozoId) {
  const columns = await getExistingColumns('tomas_nivel');

  const selectSql = buildSafeSelect(columns, [
    'id',
    'id_pozo',
    'fecha',
    'nf_pies',
    'sumergencia',
    'porcentaje_liq',
    'pip',
    'pbhp',
    'presion_casing',
    'presion_tubing',
    'torque',
    'amp',
    'freq',
    'volts',
    'rpm',
    'hp',
    'diagnostico',
    'observacion',
    'comentario',
    'recomendacion_ejecutada',
    'recomendacion',
    'sync_status',
    'id_personal',
    'uuid_local',
    'id_usuario_carga'
  ]);

  return query(
    `
    SELECT
      ${selectSql}
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
 * Regla:
 * - La base SIEMPRE son las fechas donde existe toma de nivel.
 * - Luego se busca el parámetro de esa misma fecha.
 * - Si no hay parámetro en esa fecha, la fila queda con diferencias NULL.
 */
async function getComparativoParametrosNivelesByPozo(pozoId) {
  try {
    const parametrosColumns = await getExistingColumns('parametros_diarios');
    const nivelesColumns = await getExistingColumns('tomas_nivel');

    if (!parametrosColumns.size || !nivelesColumns.size) return [];
    if (!parametrosColumns.has('fecha') || !nivelesColumns.has('fecha')) return [];

    const paramId = parametrosColumns.has('id') ? 'pd.id' : 'NULL';
    const nivelId = nivelesColumns.has('id') ? 'tn.id' : 'NULL';

    const paramRpm = parametrosColumns.has('rpm') ? 'pd.rpm' : 'NULL';
    const nivelRpm = nivelesColumns.has('rpm') ? 'tn.rpm' : 'NULL';

    const paramTorque = parametrosColumns.has('torque') ? 'pd.torque' : 'NULL';
    const nivelTorque = nivelesColumns.has('torque') ? 'tn.torque' : 'NULL';

    const paramAmp = parametrosColumns.has('amp') ? 'pd.amp' : 'NULL';
    const nivelAmp = nivelesColumns.has('amp') ? 'tn.amp' : 'NULL';

    const paramHp = parametrosColumns.has('hp') ? 'pd.hp' : 'NULL';
    const nivelHp = nivelesColumns.has('hp') ? 'tn.hp' : 'NULL';

    const paramCasing = parametrosColumns.has('presion_casing') ? 'pd.presion_casing' : 'NULL';
    const nivelCasing = nivelesColumns.has('presion_casing') ? 'tn.presion_casing' : 'NULL';

    const paramTubing = parametrosColumns.has('presion_tubing') ? 'pd.presion_tubing' : 'NULL';
    const nivelTubing = nivelesColumns.has('presion_tubing') ? 'tn.presion_tubing' : 'NULL';

    return await query(
      `
      SELECT
        nivel_base.fecha AS fecha,
        nivel_base.fecha AS fecha_nivel,
        parametro_base.fecha AS fecha_parametro,

        parametro_base.rpm AS rpm_parametros,
        nivel_base.rpm AS rpm_nivel,
        CASE
          WHEN parametro_base.rpm IS NOT NULL AND nivel_base.rpm IS NOT NULL
            THEN parametro_base.rpm - nivel_base.rpm
          ELSE NULL
        END AS dif_rpm,

        parametro_base.torque AS torque_parametros,
        nivel_base.torque AS torque_nivel,
        CASE
          WHEN parametro_base.torque IS NOT NULL AND nivel_base.torque IS NOT NULL
            THEN parametro_base.torque - nivel_base.torque
          ELSE NULL
        END AS dif_torque,

        parametro_base.amp AS amp_parametros,
        nivel_base.amp AS amp_nivel,
        CASE
          WHEN parametro_base.amp IS NOT NULL AND nivel_base.amp IS NOT NULL
            THEN parametro_base.amp - nivel_base.amp
          ELSE NULL
        END AS dif_amp,

        parametro_base.hp AS hp_parametros,
        nivel_base.hp AS hp_nivel,
        CASE
          WHEN parametro_base.hp IS NOT NULL AND nivel_base.hp IS NOT NULL
            THEN parametro_base.hp - nivel_base.hp
          ELSE NULL
        END AS dif_hp,

        parametro_base.presion_casing AS casing_parametros,
        nivel_base.presion_casing AS casing_nivel,
        CASE
          WHEN parametro_base.presion_casing IS NOT NULL AND nivel_base.presion_casing IS NOT NULL
            THEN parametro_base.presion_casing - nivel_base.presion_casing
          ELSE NULL
        END AS dif_presion_casing,

        parametro_base.presion_tubing AS tubing_parametros,
        nivel_base.presion_tubing AS tubing_nivel,
        CASE
          WHEN parametro_base.presion_tubing IS NOT NULL AND nivel_base.presion_tubing IS NOT NULL
            THEN parametro_base.presion_tubing - nivel_base.presion_tubing
          ELSE NULL
        END AS dif_presion_tubing,

        nivel_base.id_nivel,
        parametro_base.id_parametro

      FROM (
        SELECT
          nivel_ordenado.*
        FROM (
          SELECT
            tn.id_pozo,
            ${nivelId} AS id_nivel,
            DATE(tn.fecha) AS fecha_join,
            tn.fecha,
            ${nivelRpm} AS rpm,
            ${nivelTorque} AS torque,
            ${nivelAmp} AS amp,
            ${nivelHp} AS hp,
            ${nivelCasing} AS presion_casing,
            ${nivelTubing} AS presion_tubing,
            ROW_NUMBER() OVER (
              PARTITION BY tn.id_pozo, DATE(tn.fecha)
              ORDER BY tn.fecha DESC, ${nivelesColumns.has('id') ? 'tn.id DESC' : 'tn.id_pozo DESC'}
            ) AS rn
          FROM tomas_nivel tn
          WHERE tn.id_pozo = ?
            AND tn.fecha IS NOT NULL
        ) nivel_ordenado
        WHERE nivel_ordenado.rn = 1
      ) nivel_base

      LEFT JOIN (
        SELECT
          param_ordenado.*
        FROM (
          SELECT
            pd.id_pozo,
            ${paramId} AS id_parametro,
            DATE(pd.fecha) AS fecha_join,
            pd.fecha,
            ${paramRpm} AS rpm,
            ${paramTorque} AS torque,
            ${paramAmp} AS amp,
            ${paramHp} AS hp,
            ${paramCasing} AS presion_casing,
            ${paramTubing} AS presion_tubing,
            ROW_NUMBER() OVER (
              PARTITION BY pd.id_pozo, DATE(pd.fecha)
              ORDER BY pd.fecha DESC, ${parametrosColumns.has('id') ? 'pd.id DESC' : 'pd.id_pozo DESC'}
            ) AS rn
          FROM parametros_diarios pd
          WHERE pd.id_pozo = ?
            AND pd.fecha IS NOT NULL
        ) param_ordenado
        WHERE param_ordenado.rn = 1
      ) parametro_base
        ON parametro_base.id_pozo = nivel_base.id_pozo
       AND parametro_base.fecha_join = nivel_base.fecha_join

      ORDER BY
        nivel_base.fecha DESC,
        nivel_base.id_nivel DESC
      `,
      [pozoId, pozoId]
    );
  } catch (error) {
    console.error('[POZO/COMPARATIVO] Error:', error);

    if (
      error.code === 'ER_NO_SUCH_TABLE' ||
      error.code === 'ER_BAD_TABLE_ERROR' ||
      error.code === 'ER_VIEW_INVALID' ||
      error.code === 'ER_BAD_FIELD_ERROR'
    ) {
      return [];
    }

    throw error;
  }
}

/**
 * Últimas muestras asociadas al pozo.
 */
async function getUltimasMuestrasByPozo(pozoId, limit = 500) {
  const columns = await getExistingColumns('muestras_fluido');

  const selectSql = buildSafeSelect(columns, [
    'id',
    'id_pozo',
    'fecha',
    'ays',
    'api',
    'representativa',
    'prox_muestra',
    'sync_status',
    'id_personal',
    'uuid_local',
    'id_usuario_carga'
  ]);

  return query(
    `
    SELECT
      mf_data.*,
      p.codigo
    FROM (
      SELECT
        ${selectSql}
      FROM muestras_fluido
      WHERE id_pozo = ?
      ORDER BY
        fecha DESC,
        id DESC
      LIMIT ?
    ) mf_data
    INNER JOIN pozos p
      ON p.id = mf_data.id_pozo
    ORDER BY
      mf_data.fecha DESC,
      mf_data.id DESC
    `,
    [pozoId, Number(limit) || 10]
  );
}

/**
 * Timeline compacto usado por la ficha.
 */
async function getPozoTimeline(pozoId, preloaded = {}) {
  const parametrosPromise = preloaded.parametros
    ? Promise.resolve(preloaded.parametros)
    : getHistorialParametrosByPozo(pozoId);

  const nivelesPromise = preloaded.niveles
    ? Promise.resolve(preloaded.niveles)
    : getHistorialNivelesByPozo(pozoId);

  const bombasPromise = preloaded.bombas
    ? Promise.resolve(preloaded.bombas)
    : getHistorialBombasByPozo(pozoId);

  const muestrasPromise = preloaded.muestras
    ? Promise.resolve(preloaded.muestras)
    : getUltimasMuestrasByPozo(pozoId, 20);

  const [parametros, niveles, bombas, muestras] = await Promise.all([
    parametrosPromise,
    nivelesPromise,
    bombasPromise,
    muestrasPromise
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
    muestras
  };
}

/**
 * Bootstrap completo para APIs internas o vistas de detalle.
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
    getSurveyActivoByPozo(pozo.id)
  ]);

  const timeline = await getPozoTimeline(pozo.id, {
    parametros: historialParametros,
    niveles: historialNiveles,
    bombas: historialBombas,
    muestras: ultimasMuestras
  });

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

    const loteCarga = `manual-${Date.now()}`;

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
          loteCarga
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
    WHERE id = ?
      OR codigo = ?
    `,
    [value, id, id]
  );

  return {
    affectedRows: result.affectedRows,
    potencial: value
  };
}

/**
 * Helpers para ficha / equipos actuales.
 */
async function getPozoEquipmentIds(pozoId) {
  const pozosColumns = await getExistingColumns('pozos');

  const selectParts = ['id'];

  if (pozosColumns.has('id_vdf')) {
    selectParts.push('id_vdf');
  } else {
    selectParts.push('NULL AS id_vdf');
  }

  if (pozosColumns.has('id_cabezal')) {
    selectParts.push('id_cabezal');
  } else {
    selectParts.push('NULL AS id_cabezal');
  }

  const rows = await query(
    `
    SELECT
      ${selectParts.join(',\n      ')}
    FROM pozos
    WHERE id = ?
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || {
    id_vdf: null,
    id_cabezal: null
  };
}

async function getEquipoActualPozo(pozoId) {
  const columns = await getExistingColumns('pozo_equipos_actuales');

  if (!columns.size || !columns.has('id_pozo')) {
    return null;
  }

  const selectSql = buildSafeSelect(columns, [
    'id',
    'id_pozo',
    'fecha_referencia',
    'variador_nombre_original',
    'variador_capacidad_hp',
    'variador_capacidad_kva',
    'cabezal_nombre_original',
    'cabezal_hp_total',
    'cabezal_hp_motor',
    'cabezal_cantidad_motores',
    'cabezal_configuracion_motor',
    'created_at',
    'updated_at'
  ]);

  const orderParts = [];

  if (columns.has('fecha_referencia')) {
    orderParts.push('fecha_referencia DESC');
  }

  if (columns.has('updated_at')) {
    orderParts.push('updated_at DESC');
  }

  if (columns.has('created_at')) {
    orderParts.push('created_at DESC');
  }

  if (columns.has('id')) {
    orderParts.push('id DESC');
  }

  const orderSql = orderParts.length
    ? orderParts.join(', ')
    : 'id_pozo DESC';

  const rows = await query(
    `
    SELECT
      ${selectSql}
    FROM pozo_equipos_actuales
    WHERE id_pozo = ?
    ORDER BY
      ${orderSql}
    LIMIT 1
    `,
    [pozoId]
  );

  return rows[0] || null;
}

async function getVariadorCatalogo(idVdf) {
  if (!idVdf) return null;

  const columns = await getExistingColumns('vdfs');

  if (!columns.size || !columns.has('id')) {
    return null;
  }

  const selectSql = buildSafeSelect(columns, [
    'id',
    'nombre',
    'marca',
    'modelo',
    'capacidad',
    'potencia_hp',
    'hp'
  ]);

  const rows = await query(
    `
    SELECT
      ${selectSql}
    FROM vdfs
    WHERE id = ?
    LIMIT 1
    `,
    [idVdf]
  );

  return rows[0] || null;
}

async function getCabezalCatalogo(idCabezal) {
  if (!idCabezal) return null;

  const columns = await getExistingColumns('cabezales');

  if (!columns.size || !columns.has('id')) {
    return null;
  }

  const selectSql = buildSafeSelect(columns, [
    'id',
    'nombre',
    'marca',
    'modelo',
    'hp',
    'potencia_motor',
    'capacidad_klbs'
  ]);

  const rows = await query(
    `
    SELECT
      ${selectSql}
    FROM cabezales
    WHERE id = ?
    LIMIT 1
    `,
    [idCabezal]
  );

  return rows[0] || null;
}

async function getMotoresCabezalActuales(pozoId) {
  const columns = await getExistingColumns('motores_cabezales');

  if (!columns.size || !columns.has('id_pozo')) {
    return null;
  }

  const hpColumn = columns.has('hp')
    ? 'hp'
    : columns.has('potencia_hp')
      ? 'potencia_hp'
      : columns.has('potencia')
        ? 'potencia'
        : null;

  const cantidadColumn = columns.has('cantidad_motores')
    ? 'cantidad_motores'
    : columns.has('cantidad')
      ? 'cantidad'
      : null;

  if (!hpColumn) {
    return null;
  }

  const where = ['id_pozo = ?'];

  if (columns.has('activo')) {
    where.push('activo = 1');
  }

  const orderParts = [];

  if (columns.has('fecha_referencia')) {
    orderParts.push('fecha_referencia DESC');
  }

  if (columns.has('updated_at')) {
    orderParts.push('updated_at DESC');
  }

  if (columns.has('created_at')) {
    orderParts.push('created_at DESC');
  }

  if (columns.has('id')) {
    orderParts.push('id DESC');
  }

  const orderSql = orderParts.length
    ? orderParts.join(', ')
    : 'id_pozo DESC';

  const cantidadExpr = cantidadColumn || '1';

  const rows = await query(
    `
    SELECT
      ${cantidadExpr} AS cantidad_motores,
      ${hpColumn} AS hp
    FROM motores_cabezales
    WHERE ${where.join(' AND ')}
    ORDER BY
      ${orderSql}
    LIMIT 1
    `,
    [pozoId]
  );

  const row = rows[0] || null;

  if (!row) return null;

  const cantidad = normalizeNumericDisplay(row.cantidad_motores || 1);
  const hp = normalizeNumericDisplay(row.hp);

  if (!hp) return null;

  return {
    configuracion_motor: `${cantidad || 1}x${hp}`
  };
}

function normalizePozoFicha(pozo) {
  if (!pozo) return pozo;

  const variadorNombre = firstUsefulServiceValue([
    pozo.variador_nombre_original,
    pozo.variador,
    pozo.variador_nombre,
    pozo.variador_catalogo_nombre,
    pozo.variador_catalogo_marca,
    pozo.variador_catalogo_modelo
  ]);

  const variadorPotencia = firstUsefulServiceValue([
    pozo.variador_capacidad_hp,
    pozo.variador_potencia_hp,
    pozo.variador_catalogo_potencia_hp
  ]);

  const variadorCapacidad = firstUsefulServiceValue([
    pozo.variador_capacidad_kva,
    pozo.variador_capacidad,
    pozo.variador_catalogo_capacidad,
    pozo.variador_capacidad_hp,
    pozo.variador_potencia_hp,
    pozo.variador_catalogo_potencia_hp
  ]);

  const cabezalNombre = firstUsefulServiceValue([
    pozo.cabezal_nombre_original,
    pozo.cabezal,
    pozo.cabezal_nombre,
    pozo.cabezal_catalogo_nombre,
    pozo.cabezal_catalogo_marca,
    pozo.cabezal_catalogo_modelo
  ]);

  const cabezalMotores = normalizeMotorConfig(
    firstUsefulServiceValue([
      pozo.cabezal_configuracion_motor,
      pozo.motores_cabezal_configuracion,
      buildMotorConfigFromEquipoActual(pozo),
      pozo.cabezal_catalogo_potencia_motor,
      pozo.cabezal_catalogo_hp,
      pozo.cabezal_hp_total,
      pozo.cabezal_hp_motor
    ])
  );

  return {
    ...pozo,

    variador: cleanServiceDisplayValue(variadorNombre),
    variador_nombre: cleanServiceDisplayValue(variadorNombre),

    variador_potencia_hp: normalizeNumericDisplay(variadorPotencia),
    variador_capacidad: normalizeNumericDisplay(variadorCapacidad),
    variador_capacidad_kva: normalizeNumericDisplay(pozo.variador_capacidad_kva),
    variador_capacidad_hp: normalizeNumericDisplay(pozo.variador_capacidad_hp),

    cabezal: cleanServiceDisplayValue(cabezalNombre),
    cabezal_nombre: cleanServiceDisplayValue(cabezalNombre),

    cabezal_motores: cabezalMotores,
    cabezal_configuracion_motor: cabezalMotores
  };
}

function buildMotorConfigFromEquipoActual(pozo) {
  const cantidad = normalizeNumericDisplay(pozo?.cabezal_cantidad_motores);
  const hpMotor = normalizeNumericDisplay(pozo?.cabezal_hp_motor);

  if (cantidad && hpMotor) {
    return `${cantidad}x${hpMotor}`;
  }

  return null;
}

function firstUsefulServiceValue(values = []) {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    const clean = String(value).trim();

    if (
      clean &&
      clean !== '-' &&
      clean !== '.' &&
      clean !== ',' &&
      clean.toLowerCase() !== 'null' &&
      clean.toLowerCase() !== 'undefined' &&
      clean.toLowerCase() !== 'sin dato' &&
      clean.toLowerCase() !== 'sin datos'
    ) {
      return value;
    }
  }

  return null;
}

function cleanServiceDisplayValue(value) {
  const clean = firstUsefulServiceValue([value]);
  return clean === null ? null : String(clean).trim();
}

function normalizeNumericDisplay(value) {
  const clean = firstUsefulServiceValue([value]);

  if (clean === null) return null;

  const text = String(clean).trim().replace(',', '.');
  const number = Number(text);

  if (!Number.isFinite(number)) {
    return String(clean).trim();
  }

  if (Number.isInteger(number)) {
    return String(number);
  }

  return String(number).replace(/\.00$/, '');
}

function normalizeMotorConfig(value) {
  const clean = firstUsefulServiceValue([value]);

  if (clean === null) return null;

  let text = String(clean).trim();

  text = text.replace(/\s+/g, '');
  text = text.replace(/\.00/g, '');
  text = text.replace(/X/g, 'x');

  if (/^\d+(\.\d+)?$/.test(text)) {
    return `1x${normalizeNumericDisplay(text)}`;
  }

  text = text.replace(/^(\d+)(?:\.0+)?x(\d+)(?:\.0+)?$/i, '$1x$2');

  return text;
}

async function updateMuestraRepresentativa({ pozoId, muestraId, representativa }) {
  const [result] = await pool.query(
    `
    UPDATE muestras_fluido
    SET representativa = ?
    WHERE id = ?
      AND id_pozo = ?
    `,
    [representativa ? 1 : 0, muestraId, pozoId]
  );

  return {
    affectedRows: result.affectedRows,
    representativa: representativa ? 1 : 0
  };
}

module.exports = {
  POZO_SERVICE_VERSION,

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

  updatePozoPotencial,

  updateMuestraRepresentativa
};