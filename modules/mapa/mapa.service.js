const { pool } = require('../../config/db');

const ACTIVE_ASSIGNMENT_STATUS = 'asignado';
const CLOSED_ASSIGNMENT_STATUS = 'finalizado';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeLower(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;

  const text = normalizeLower(value);

  if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(text)) return 1;
  if (['false', '0', 'no', 'n'].includes(text)) return 0;

  return null;
}

function normalizeCodigoPozo(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const upper = raw.toUpperCase().replace(/\s+/g, '').replace('_', '-');

  const mfbMatch = upper.match(/^MFB-?0*(\d+)$/);
  if (mfbMatch) {
    return `MFB-${String(Number(mfbMatch[1])).padStart(4, '0')}`;
  }

  const looseMfbMatch = upper.match(/MFB-?0*(\d+)/);
  if (looseMfbMatch) {
    return `MFB-${String(Number(looseMfbMatch[1])).padStart(4, '0')}`;
  }

  const numericMatch = upper.match(/^0*(\d+)$/);
  if (numericMatch) {
    return `MFB-${String(Number(numericMatch[1])).padStart(4, '0')}`;
  }

  return upper;
}

function normalizeEstadoNombre(value) {
  const text = normalizeLower(value);

  const aliases = {
    activo: 'Activo',
    diferido: 'Diferido',
    candidato: 'Candidato',
    candidatos: 'Candidato',
    diagnostico: 'Diagnóstico',
    'diagnóstico': 'Diagnóstico',
    'en servicio': 'En servicio',
    'en-servicio': 'En servicio',
    servicio: 'En servicio',
    'inactivo-servicio': 'Inactivo en espera por servicio',
    'en espera': 'Inactivo en espera por servicio',
    'en-espera': 'Inactivo en espera por servicio',
    espera: 'Inactivo en espera por servicio',
    'en espera de servicio': 'Inactivo en espera por servicio',
    'inactivo en espera por servicio': 'Inactivo en espera por servicio'
  };

  return aliases[text] || normalizeText(value);
}

function normalizeDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmyDash = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;

  const dmySlash = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlash) return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function formatDateDdMmYyyy(value) {
  const date = normalizeDateOnly(value);
  if (!date) return null;

  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

function getPayloadPozoId(payload = {}) {
  const directId = normalizeNumber(payload.id_pozo ?? payload.idPozo ?? payload.pozoId ?? payload.dbId);
  if (directId) return directId;

  const pozo = payload.pozo || payload.well || null;
  return normalizeNumber(pozo?.id_pozo ?? pozo?.idPozo ?? pozo?.pozoId ?? pozo?.dbId);
}

function getPayloadCodigoPozo(payload = {}) {
  const pozo = payload.pozo || payload.well || null;

  return normalizeCodigoPozo(
    payload.codigo ??
    payload.codigo_pozo ??
    payload.codigoPozo ??
    payload.pozoCodigo ??
    payload.id ??
    pozo?.codigo ??
    pozo?.id
  );
}

function getPayloadServicio(payload = {}) {
  const pozo = payload.pozo || payload.well || null;

  return normalizeText(
    payload.nombre_servicio ??
    payload.nombreServicio ??
    payload.servicio ??
    payload.taladro ??
    pozo?.servicioAsignado ??
    pozo?.servicio_asignado ??
    pozo?.taladro
  );
}

function getEstadoSaliente(payload = {}) {
  return normalizeEstadoNombre(
    payload.estadoSaliente ??
    payload.estado_pozo_saliente ??
    payload.estadoAnterior ??
    payload.estadoFinalAnterior ??
    payload.estadoFinal ??
    payload.estado_final ??
    'Activo'
  );
}

function getCausaDiferido(payload = {}) {
  return normalizeText(
    payload.causaDiferido ??
    payload.causa_diferido ??
    payload.observacionDiferido ??
    payload.observacion
  );
}

function buildObservationUpdateSql(alias = '') {
  const prefix = alias ? `${alias}.` : '';

  return `
    ${prefix}observacion = CASE
      WHEN ? IS NULL OR ? = '' THEN ${prefix}observacion
      WHEN ${prefix}observacion IS NULL OR ${prefix}observacion = '' THEN ?
      ELSE CONCAT(${prefix}observacion, ' | ', ?)
    END
  `;
}

function observationParams(observacion) {
  const value = normalizeText(observacion);
  return [value, value, value, value];
}

async function resolvePozoId(conn, payloadOrId) {
  const payload = typeof payloadOrId === 'object' && payloadOrId !== null
    ? payloadOrId
    : { id_pozo: payloadOrId };

  const idPozo = getPayloadPozoId(payload);
  if (idPozo) return idPozo;

  const codigo = getPayloadCodigoPozo(payload);
  if (!codigo) return null;

  const [rows] = await conn.query(
    `
      SELECT id
      FROM pozos
      WHERE BINARY codigo = BINARY ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0]?.id || null;
}

async function resolveEstadoId(conn, estado) {
  const normalizedEstado = normalizeEstadoNombre(estado);
  if (!normalizedEstado) return null;

  const [rows] = await conn.query(
    `
      SELECT id
      FROM estado_pozo
      WHERE BINARY nombre = BINARY ?
      LIMIT 1
    `,
    [normalizedEstado]
  );

  return rows[0]?.id || null;
}

async function resolveServicio(conn, nombreServicio) {
  const servicio = normalizeText(nombreServicio);
  if (!servicio) return null;

  const [exactRows] = await conn.query(
    `
      SELECT
        id,
        nombre,
        tipo_servicio,
        subtipo
      FROM servicios
      WHERE BINARY nombre = BINARY ?
      LIMIT 1
    `,
    [servicio]
  );

  if (exactRows[0]) return exactRows[0];

  const [looseRows] = await conn.query(
    `
      SELECT
        id,
        nombre,
        tipo_servicio,
        subtipo
      FROM servicios
      WHERE LOWER(nombre) = LOWER(?)
      LIMIT 1
    `,
    [servicio]
  );

  return looseRows[0] || null;
}

async function setPozoEstado(conn, idPozo, estado, options = {}) {
  const idEstado = await resolveEstadoId(conn, estado);
  if (!idEstado) return false;

  const causaDiferido = normalizeText(options.causaDiferido);
  const normalizedEstado = normalizeEstadoNombre(estado);

  if (normalizedEstado === 'Diferido' && causaDiferido) {
    await conn.query(
      `
        UPDATE pozos
        SET
          id_estado = ?,
          nota_operativa = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [idEstado, causaDiferido, idPozo]
    );
  } else {
    await conn.query(
      `
        UPDATE pozos
        SET
          id_estado = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [idEstado, idPozo]
    );
  }

  return true;
}

function toMapaPozo(row) {
  const fechaArranque = normalizeDateOnly(row.fecha_arranque);
  const fechaArranqueFormateada = row.fecha_arranque_formateada || formatDateDdMmYyyy(row.fecha_arranque);

  /**
   * Leaflet CRS.Simple usa [y, x].
   * Base de datos guarda coord_x / coord_y.
   */
  const coordsDiagrama = row.coord_x != null && row.coord_y != null
    ? [Number(row.coord_y), Number(row.coord_x)]
    : null;

  const coordsMapa = row.latitud != null && row.longitud != null
    ? [Number(row.latitud), Number(row.longitud)]
    : null;

  return {
    id: row.codigo,
    dbId: row.id,
    idPozo: row.id,
    codigo: row.codigo,

    estado: row.estado,
    categoria: row.categoria,
    area: row.area,
    zona: row.area,
    yacimiento: row.yacimiento,

    potencial: row.potencial,
    altoCorteAgua: Boolean(row.alto_corte_agua),
    nota: row.nota_operativa,
    notaOperativa: row.nota_operativa,

    coordsMapa,
    coordsDiagrama,
    coords: coordsMapa || coordsDiagrama,

    latitud: row.latitud,
    longitud: row.longitud,

    diagrama: row.diagrama || 'sin-asignar',
    vistaMapa: row.visible_diagrama !== 0 && row.visible_diagrama !== false,

    cabezal: row.cabezal,
    variador: row.variador,
    metodo: row.metodo_levantamiento,

    velocidadOperacional: row.vel_operacional,
    velocidadActual: row.vel_actual,

    fechaUltimoServicio: fechaArranque,
    fechaArranque,
    fecha_arranque: fechaArranque,
    fecha_arranque_formateada: fechaArranqueFormateada,
    fechaArranqueFormateada: fechaArranqueFormateada,

    servicioAsignado: row.servicio_asignado,
    taladro: row.servicio_asignado,
    tipoServicio: row.tipo_servicio,
    subtipoServicio: row.subtipo,
    estadoAsignacion: row.estado_asignacion,
    fechaAsignacion: row.fecha_asignacion,
    observacionServicio: row.observacion_servicio,
    tieneServicioActivo: Number(row.tiene_servicio_activo || 0) === 1,

    _raw: row,
    _source: 'pwa-api'
  };
}

async function health() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total_pozos
    FROM pozos
  `);

  return {
    totalPozos: rows[0]?.total_pozos || 0
  };
}

function buildMapaSelectSql() {
  return `
    SELECT
      id,
      codigo,
      categoria,
      estado,
      area,
      yacimiento,
      potencial,
      latitud,
      longitud,

      alto_corte_agua,
      nota_operativa,

      cabezal,
      variador,
      metodo_levantamiento,

      fecha_arranque,
      fecha_arranque_formateada,
      vel_operacional,
      vel_actual,

      diagrama,
      coord_x,
      coord_y,
      vista_diagrama AS visible_diagrama,

      servicio_asignado,
      tipo_servicio,
      subtipo,
      fecha_asignacion,
      estado_asignacion,
      observacion_servicio,
      tiene_servicio_activo

    FROM vw_mapa_pozos_sync
  `;
}

async function listPozos(filters = {}) {
  const where = [];
  const params = [];

  if (filters.area) {
    where.push('area = ?');
    params.push(filters.area);
  }

  if (filters.categoria) {
    where.push('categoria = ?');
    params.push(filters.categoria);
  }

  if (filters.estado) {
    where.push('estado = ?');
    params.push(normalizeEstadoNombre(filters.estado));
  }

  if (!filters.includeDiferidos) {
    where.push("(estado IS NULL OR estado <> 'Diferido')");
  }

  if (filters.search) {
    where.push(`
      (
        codigo LIKE ?
        OR area LIKE ?
        OR estado LIKE ?
        OR yacimiento LIKE ?
        OR servicio_asignado LIKE ?
      )
    `);

    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `
      ${buildMapaSelectSql()}
      ${whereSql}
      ORDER BY codigo ASC
    `,
    params
  );

  return rows.map(toMapaPozo);
}

async function getPozoById(id) {
  const codigo = normalizeCodigoPozo(id);
  const numericId = normalizeNumber(id);

  const [rows] = await pool.query(
    `
      ${buildMapaSelectSql()}
      WHERE id = ?
         OR BINARY codigo = BINARY ?
      LIMIT 1
    `,
    [numericId || 0, codigo || id]
  );

  return rows[0] ? toMapaPozo(rows[0]) : null;
}

async function updatePozo(id, payload = {}, currentUser = null) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const idPozo = normalizeNumber(id) || await resolvePozoId(conn, payload);

    if (!idPozo) {
      await conn.rollback();
      return {
        ok: false,
        message: 'ID de pozo inválido.'
      };
    }

    const fields = [];
    const params = [];

    if (payload.categoria !== undefined) {
      fields.push('categoria = ?');
      params.push(normalizeText(payload.categoria));
    }

    if (payload.area !== undefined || payload.zona !== undefined) {
      fields.push('area = ?');
      params.push(normalizeText(payload.area ?? payload.zona));
    }

    if (payload.potencial !== undefined) {
      fields.push('potencial = ?');
      params.push(normalizeNumber(payload.potencial));
    }

    if (payload.altoCorteAgua !== undefined || payload.alto_corte_agua !== undefined) {
      fields.push('alto_corte_agua = ?');
      params.push(normalizeBoolean(payload.altoCorteAgua ?? payload.alto_corte_agua));
    }

    if (payload.nota !== undefined || payload.notaOperativa !== undefined || payload.nota_operativa !== undefined) {
      fields.push('nota_operativa = ?');
      params.push(normalizeText(payload.nota ?? payload.notaOperativa ?? payload.nota_operativa));
    }

    if (payload.fechaUltimoServicio !== undefined || payload.fechaArranque !== undefined || payload.fecha_arranque !== undefined) {
      fields.push('fecha_arranque = ?');
      params.push(normalizeDateOnly(payload.fechaUltimoServicio ?? payload.fechaArranque ?? payload.fecha_arranque));
    }

    if (payload.velocidadOperacional !== undefined || payload.vel_operacional !== undefined) {
      fields.push('vel_operacional = ?');
      params.push(normalizeNumber(payload.velocidadOperacional ?? payload.vel_operacional));
    }

    if (payload.coordsMapa && Array.isArray(payload.coordsMapa)) {
      fields.push('latitud = ?');
      fields.push('longitud = ?');
      params.push(normalizeNumber(payload.coordsMapa[0]));
      params.push(normalizeNumber(payload.coordsMapa[1]));
    }

    if (payload.latitud !== undefined) {
      fields.push('latitud = ?');
      params.push(normalizeNumber(payload.latitud));
    }

    if (payload.longitud !== undefined) {
      fields.push('longitud = ?');
      params.push(normalizeNumber(payload.longitud));
    }

    if (payload.estado !== undefined) {
      const idEstado = await resolveEstadoId(conn, payload.estado);

      if (idEstado) {
        fields.push('id_estado = ?');
        params.push(idEstado);
      }
    }

    if (fields.length) {
      fields.push('updated_at = NOW()');
      params.push(idPozo);

      await conn.query(
        `
          UPDATE pozos
          SET ${fields.join(', ')}
          WHERE id = ?
        `,
        params
      );
    }

    await updatePozoDiagrama(conn, idPozo, payload);

    await conn.commit();

    return {
      ok: true,
      pozo: await getPozoById(idPozo)
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updatePozoDiagrama(conn, idPozo, payload = {}) {
  const hasDiagramPayload =
    payload.diagrama !== undefined ||
    payload.coords !== undefined ||
    payload.coordsDiagrama !== undefined ||
    payload.coord_x !== undefined ||
    payload.coord_y !== undefined ||
    payload.vistaMapa !== undefined ||
    payload.visible !== undefined;

  if (!hasDiagramPayload) return;

  const coords = Array.isArray(payload.coordsDiagrama)
    ? payload.coordsDiagrama
    : (
      Array.isArray(payload.coords)
        ? payload.coords
        : null
    );

  /**
   * Leaflet simple usa [y, x]; BD guarda coord_x y coord_y.
   */
  const coordY = coords ? normalizeNumber(coords[0]) : normalizeNumber(payload.coord_y);
  const coordX = coords ? normalizeNumber(coords[1]) : normalizeNumber(payload.coord_x);

  const visible = normalizeBoolean(payload.vistaMapa ?? payload.visible);
  const diagrama = payload.diagrama !== undefined ? normalizeText(payload.diagrama) : undefined;

  /**
   * Evita duplicados en pozos_diagrama.
   * Como no hay garantía de PK única por id_pozo, eliminamos las filas previas
   * y reinsertamos una sola fila válida cuando corresponde.
   */
  await conn.query(
    `
      DELETE FROM pozos_diagrama
      WHERE id_pozo = ?
    `,
    [idPozo]
  );

  const shouldInsert =
    diagrama &&
    diagrama !== 'sin-asignar' &&
    coordX !== null &&
    coordY !== null;

  if (!shouldInsert) return;

  await conn.query(
    `
      INSERT INTO pozos_diagrama (
        id_pozo,
        diagrama,
        coord_x,
        coord_y,
        visible,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      idPozo,
      diagrama,
      coordX,
      coordY,
      visible ?? 1
    ]
  );
}

async function listServicios() {
  const [rows] = await pool.query(
    `
      SELECT
        psa.id_pozo,
        p.codigo AS codigo_pozo,
        psa.servicio_asignado,
        psa.tipo_servicio,
        psa.subtipo,
        psa.fecha_asignacion,
        psa.estado_asignacion,
        psa.observacion
      FROM vw_servicio_actual_pozo psa
      INNER JOIN pozos p
        ON p.id = psa.id_pozo
      ORDER BY psa.servicio_asignado ASC, p.codigo ASC
    `
  );

  return rows;
}

async function getActiveAssignmentsByServiceId(conn, idServicio) {
  const [rows] = await conn.query(
    `
      SELECT
        psa.id,
        psa.id_pozo,
        psa.id_servicio,
        psa.fecha_asignacion,
        psa.estado_asignacion,
        psa.observacion,
        s.nombre AS servicio_asignado,
        s.tipo_servicio,
        s.subtipo
      FROM pozo_servicio_asignacion psa
      INNER JOIN servicios s
        ON s.id = psa.id_servicio
      WHERE psa.id_servicio = ?
        AND psa.activo = 1
    `,
    [idServicio]
  );

  return rows;
}

async function getActiveAssignmentsByPozo(conn, idPozo) {
  const [rows] = await conn.query(
    `
      SELECT
        psa.id,
        psa.id_pozo,
        psa.id_servicio,
        psa.fecha_asignacion,
        psa.estado_asignacion,
        psa.observacion,
        s.nombre AS servicio_asignado,
        s.tipo_servicio,
        s.subtipo
      FROM pozo_servicio_asignacion psa
      INNER JOIN servicios s
        ON s.id = psa.id_servicio
      WHERE psa.id_pozo = ?
        AND psa.activo = 1
    `,
    [idPozo]
  );

  return rows;
}

async function closeActiveAssignmentsByServiceId(conn, idServicio, observacion = null) {
  await conn.query(
    `
      UPDATE pozo_servicio_asignacion psa
      SET
        psa.activo = 0,
        psa.estado_asignacion = ?,
        psa.fecha_desasignacion = NOW(),
        ${buildObservationUpdateSql('psa')},
        psa.updated_at = NOW()
      WHERE psa.id_servicio = ?
        AND psa.activo = 1
    `,
    [
      CLOSED_ASSIGNMENT_STATUS,
      ...observationParams(observacion),
      idServicio
    ]
  );
}

async function closeActiveAssignmentsByPozo(conn, idPozo, observacion = null) {
  await conn.query(
    `
      UPDATE pozo_servicio_asignacion psa
      SET
        psa.activo = 0,
        psa.estado_asignacion = ?,
        psa.fecha_desasignacion = NOW(),
        ${buildObservationUpdateSql('psa')},
        psa.updated_at = NOW()
      WHERE psa.id_pozo = ?
        AND psa.activo = 1
    `,
    [
      CLOSED_ASSIGNMENT_STATUS,
      ...observationParams(observacion),
      idPozo
    ]
  );
}

async function asignarServicio(payload = {}, currentUser = null) {
  const nombreServicio = getPayloadServicio(payload);

  if (!nombreServicio) {
    return {
      ok: false,
      message: 'nombre_servicio/servicio es obligatorio.'
    };
  }

  const observacion = normalizeText(payload.observacion ?? payload.nota ?? payload.observacionServicio);
  const fechaAsignacion = normalizeDateOnly(payload.fecha_asignacion ?? payload.fechaAsignacion);
  const estadoSaliente = getEstadoSaliente(payload);
  const causaDiferido = getCausaDiferido(payload);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const idPozoDestino = await resolvePozoId(conn, payload);

    if (!idPozoDestino) {
      await conn.rollback();
      return {
        ok: false,
        message: 'No se encontró el pozo destino para asignar servicio.'
      };
    }

    const servicio = await resolveServicio(conn, nombreServicio);

    if (!servicio) {
      await conn.rollback();
      return {
        ok: false,
        message: `No se encontró el servicio "${nombreServicio}" en el catálogo servicios.`
      };
    }

    const previousServiceAssignments = await getActiveAssignmentsByServiceId(conn, servicio.id);
    const previousDestinoAssignments = await getActiveAssignmentsByPozo(conn, idPozoDestino);

    const uniquePozosSalientes = [
      ...new Set(
        previousServiceAssignments
          .map(row => row.id_pozo)
          .filter(idPozo => idPozo && Number(idPozo) !== Number(idPozoDestino))
      )
    ];

    /**
     * Cierra:
     * 1) El mismo servicio si estaba en otro pozo.
     * 2) Cualquier servicio que ya tuviera el pozo destino.
     */
    await closeActiveAssignmentsByServiceId(conn, servicio.id, observacion);
    await closeActiveAssignmentsByPozo(conn, idPozoDestino, observacion);

    for (const idPozoSaliente of uniquePozosSalientes) {
      await setPozoEstado(conn, idPozoSaliente, estadoSaliente || 'Activo', {
        causaDiferido
      });
    }

    await conn.query(
      `
        INSERT INTO pozo_servicio_asignacion (
          id_pozo,
          id_servicio,
          fecha_asignacion,
          fecha_desasignacion,
          estado_asignacion,
          observacion,
          activo,
          created_at,
          updated_at
        )
        VALUES (?, ?, COALESCE(?, NOW()), NULL, ?, ?, 1, NOW(), NOW())
      `,
      [
        idPozoDestino,
        servicio.id,
        fechaAsignacion,
        ACTIVE_ASSIGNMENT_STATUS,
        observacion
      ]
    );

    await setPozoEstado(conn, idPozoDestino, 'En servicio');

    await conn.commit();

    return {
      ok: true,
      pozo: await getPozoById(idPozoDestino),
      pozosSalientes: await Promise.all(uniquePozosSalientes.map(getPozoById)),
      serviciosCerradosDestino: previousDestinoAssignments.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function desasignarServicio(payload = {}, currentUser = null) {
  const estadoFinal = normalizeEstadoNombre(
    payload.estadoFinal ??
    payload.estado_final ??
    payload.estado ??
    payload.estadoAnterior ??
    'Activo'
  );

  const causaDiferido = getCausaDiferido(payload);
  const observacion = causaDiferido || normalizeText(payload.observacion);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const idPozo = await resolvePozoId(conn, payload);
    const nombreServicio = getPayloadServicio(payload);
    const servicio = nombreServicio ? await resolveServicio(conn, nombreServicio) : null;

    if (!idPozo && !servicio) {
      await conn.rollback();
      return {
        ok: false,
        message: 'Debe indicar pozo o servicio para desasignar.'
      };
    }

    const where = ['psa.activo = 1'];
    const params = [];

    if (idPozo) {
      where.push('psa.id_pozo = ?');
      params.push(idPozo);
    }

    if (servicio) {
      where.push('psa.id_servicio = ?');
      params.push(servicio.id);
    }

    const [activeRows] = await conn.query(
      `
        SELECT
          psa.id,
          psa.id_pozo,
          psa.id_servicio,
          s.nombre AS servicio_asignado
        FROM pozo_servicio_asignacion psa
        INNER JOIN servicios s
          ON s.id = psa.id_servicio
        WHERE ${where.join(' AND ')}
      `,
      params
    );

    await conn.query(
      `
        UPDATE pozo_servicio_asignacion psa
        SET
          psa.activo = 0,
          psa.estado_asignacion = ?,
          psa.fecha_desasignacion = NOW(),
          ${buildObservationUpdateSql('psa')},
          psa.updated_at = NOW()
        WHERE ${where.join(' AND ')}
      `,
      [
        CLOSED_ASSIGNMENT_STATUS,
        ...observationParams(observacion),
        ...params
      ]
    );

    const affectedPozoIds = [
      ...new Set(activeRows.map(row => row.id_pozo).filter(Boolean))
    ];

    /**
     * Si no había asignación activa pero vino id_pozo,
     * igual actualizamos estado para que el mapa/PWA queden consistentes.
     */
    if (!affectedPozoIds.length && idPozo) {
      affectedPozoIds.push(idPozo);
    }

    for (const affectedIdPozo of affectedPozoIds) {
      await setPozoEstado(conn, affectedIdPozo, estadoFinal || 'Activo', {
        causaDiferido
      });
    }

    await conn.commit();

    return {
      ok: true,
      pozos: await Promise.all(affectedPozoIds.map(getPozoById))
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateServicioAsignado(id, payload = {}, currentUser = null) {
  const action = normalizeLower(payload.action ?? payload.accion);
  const estadoAsignacion = normalizeLower(payload.estado_asignacion ?? payload.estadoAsignacion);

  const shouldClose =
    payload.activo === false ||
    payload.activo === 0 ||
    estadoAsignacion === CLOSED_ASSIGNMENT_STATUS ||
    estadoAsignacion === 'cerrado' ||
    action === 'desasignar' ||
    action === 'cerrar';

  if (shouldClose) {
    return desasignarServicio({
      ...payload,
      id_pozo: payload.id_pozo ?? payload.idPozo ?? payload.pozoId ?? id
    }, currentUser);
  }

  const conn = await pool.getConnection();

  try {
    const idPozo = await resolvePozoId(conn, {
      ...payload,
      id_pozo: payload.id_pozo ?? payload.idPozo ?? payload.pozoId ?? id
    });

    if (!idPozo) {
      return {
        ok: false,
        message: 'No se encontró el pozo para actualizar el servicio.'
      };
    }

    const fields = [];
    const params = [];

    if (payload.nombre_servicio !== undefined || payload.nombreServicio !== undefined || payload.servicio !== undefined) {
      const servicio = await resolveServicio(
        conn,
        payload.nombre_servicio ?? payload.nombreServicio ?? payload.servicio
      );

      if (!servicio) {
        return {
          ok: false,
          message: 'Servicio no encontrado en catálogo.'
        };
      }

      fields.push('id_servicio = ?');
      params.push(servicio.id);
    }

    if (payload.estado_asignacion !== undefined || payload.estadoAsignacion !== undefined) {
      fields.push('estado_asignacion = ?');
      params.push(normalizeText(payload.estado_asignacion ?? payload.estadoAsignacion));
    }

    if (payload.observacion !== undefined) {
      fields.push('observacion = ?');
      params.push(normalizeText(payload.observacion));
    }

    if (payload.fecha_asignacion !== undefined || payload.fechaAsignacion !== undefined) {
      fields.push('fecha_asignacion = ?');
      params.push(normalizeDateOnly(payload.fecha_asignacion ?? payload.fechaAsignacion));
    }

    if (!fields.length) {
      return {
        ok: false,
        message: 'No hay campos para actualizar.'
      };
    }

    fields.push('updated_at = NOW()');

    await conn.query(
      `
        UPDATE pozo_servicio_asignacion
        SET ${fields.join(', ')}
        WHERE id_pozo = ?
          AND activo = 1
      `,
      [...params, idPozo]
    );

    return {
      ok: true,
      pozo: await getPozoById(idPozo)
    };
  } finally {
    conn.release();
  }
}

module.exports = {
  health,
  listPozos,
  getPozoById,
  updatePozo,
  listServicios,
  asignarServicio,
  desasignarServicio,
  updateServicioAsignado
};