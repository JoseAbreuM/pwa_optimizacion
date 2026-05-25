const { pool } = require('../../config/db');

const ACTIVE_SERVICE_STATUSES = ['asignado', 'activo', 'en servicio', 'en-servicio'];
const CLOSED_SERVICE_STATUS = 'cerrado';

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

  if (['true', '1', 'si', 'yes', 'y'].includes(text)) return 1;
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

function activeStatusesPlaceholders() {
  return ACTIVE_SERVICE_STATUSES.map(() => '?').join(', ');
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

function getPayloadTipoServicio(payload = {}) {
  const servicio = getPayloadServicio(payload);
  const explicit = normalizeText(payload.tipo_servicio ?? payload.tipoServicio ?? payload.tipo);

  if (explicit) return explicit;
  if (!servicio) return 'servicio';

  const normalized = servicio.toLowerCase();
  if (normalized === 'ct') return 'CT';
  if (normalized === 'wt') return 'WT';
  if (normalized.includes('rig') || normalized.includes('ranger')) return 'Taladro';

  return 'servicio';
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
    where.push(`(
      codigo LIKE ?
      OR area LIKE ?
      OR estado LIKE ?
      OR yacimiento LIKE ?
      OR servicio_asignado LIKE ?
    )`);

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

  // Leaflet simple usa [y, x]; BD guarda coord_x y coord_y.
  const coordY = coords ? normalizeNumber(coords[0]) : normalizeNumber(payload.coord_y);
  const coordX = coords ? normalizeNumber(coords[1]) : normalizeNumber(payload.coord_x);

  const visible = normalizeBoolean(payload.vistaMapa ?? payload.visible);
  const diagrama = payload.diagrama !== undefined ? normalizeText(payload.diagrama) : undefined;

  const [existingRows] = await conn.query(
    `
      SELECT id_pozo
      FROM pozos_diagrama
      WHERE id_pozo = ?
      LIMIT 1
    `,
    [idPozo]
  );

  if (existingRows.length) {
    const fields = [];
    const params = [];

    if (diagrama !== undefined) {
      fields.push('diagrama = ?');
      params.push(diagrama);
    }

    if (coordX !== null) {
      fields.push('coord_x = ?');
      params.push(coordX);
    }

    if (coordY !== null) {
      fields.push('coord_y = ?');
      params.push(coordY);
    }

    if (visible !== null) {
      fields.push('visible = ?');
      params.push(visible);
    }

    if (!fields.length) return;

    fields.push('updated_at = NOW()');
    params.push(idPozo);

    await conn.query(
      `
        UPDATE pozos_diagrama
        SET ${fields.join(', ')}
        WHERE id_pozo = ?
      `,
      params
    );

    return;
  }

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
      diagrama ?? null,
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

async function getActiveAssignmentsByService(conn, nombreServicio) {
  const [rows] = await conn.query(
    `
      SELECT id_pozo, servicio_asignado, estado_asignacion
      FROM pozo_servicio_asignacion
      WHERE BINARY servicio_asignado = BINARY ?
        AND LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})
    `,
    [nombreServicio, ...ACTIVE_SERVICE_STATUSES]
  );

  return rows;
}

async function getActiveAssignmentsByPozo(conn, idPozo) {
  const [rows] = await conn.query(
    `
      SELECT id_pozo, servicio_asignado, estado_asignacion
      FROM pozo_servicio_asignacion
      WHERE id_pozo = ?
        AND LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})
    `,
    [idPozo, ...ACTIVE_SERVICE_STATUSES]
  );

  return rows;
}

async function closeActiveAssignmentsByService(conn, nombreServicio, observacion = null) {
  await conn.query(
    `
      UPDATE pozo_servicio_asignacion
      SET
        estado_asignacion = ?,
        observacion = COALESCE(?, observacion)
      WHERE BINARY servicio_asignado = BINARY ?
        AND LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})
    `,
    [CLOSED_SERVICE_STATUS, observacion, nombreServicio, ...ACTIVE_SERVICE_STATUSES]
  );
}

async function closeActiveAssignmentsByPozo(conn, idPozo, observacion = null) {
  await conn.query(
    `
      UPDATE pozo_servicio_asignacion
      SET
        estado_asignacion = ?,
        observacion = COALESCE(?, observacion)
      WHERE id_pozo = ?
        AND LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})
    `,
    [CLOSED_SERVICE_STATUS, observacion, idPozo, ...ACTIVE_SERVICE_STATUSES]
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

  const tipoServicio = getPayloadTipoServicio(payload);
  const estadoAsignacion = normalizeText(payload.estado_asignacion ?? payload.estadoAsignacion ?? 'activo') || 'activo';
  const observacion = normalizeText(payload.observacion ?? payload.nota ?? payload.observacionServicio);
  const fechaAsignacion = normalizeDateOnly(payload.fecha_asignacion ?? payload.fechaAsignacion) || null;
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

    const previousServiceAssignments = await getActiveAssignmentsByService(conn, nombreServicio);
    const previousDestinoAssignments = await getActiveAssignmentsByPozo(conn, idPozoDestino);

    const pozosSalientes = [
      ...previousServiceAssignments
        .map(row => row.id_pozo)
        .filter(idPozo => idPozo && Number(idPozo) !== Number(idPozoDestino))
    ];

    const uniquePozosSalientes = [...new Set(pozosSalientes)];

    await closeActiveAssignmentsByService(conn, nombreServicio, observacion);
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
          servicio_asignado,
          tipo_servicio,
          fecha_asignacion,
          estado_asignacion,
          observacion
        )
        VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?)
      `,
      [
        idPozoDestino,
        nombreServicio,
        tipoServicio,
        fechaAsignacion,
        estadoAsignacion,
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
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const idPozo = await resolvePozoId(conn, payload);
    const nombreServicio = getPayloadServicio(payload);

    if (!idPozo && !nombreServicio) {
      await conn.rollback();
      return {
        ok: false,
        message: 'Debe indicar pozo o servicio para desasignar.'
      };
    }

    const params = [];
    const where = [`LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})`];
    params.push(...ACTIVE_SERVICE_STATUSES);

    if (idPozo) {
      where.push('id_pozo = ?');
      params.push(idPozo);
    }

    if (nombreServicio) {
      where.push('BINARY servicio_asignado = BINARY ?');
      params.push(nombreServicio);
    }

    const [activeRows] = await conn.query(
      `
        SELECT id_pozo, servicio_asignado
        FROM pozo_servicio_asignacion
        WHERE ${where.join(' AND ')}
      `,
      params
    );

    await conn.query(
      `
        UPDATE pozo_servicio_asignacion
        SET
          estado_asignacion = ?,
          observacion = COALESCE(?, observacion)
        WHERE ${where.join(' AND ')}
      `,
      [CLOSED_SERVICE_STATUS, causaDiferido, ...params]
    );

    const affectedPozoIds = [...new Set(activeRows.map(row => row.id_pozo).filter(Boolean))];

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
    estadoAsignacion === CLOSED_SERVICE_STATUS ||
    action === 'desasignar' ||
    action === 'cerrar';

  if (shouldClose) {
    return desasignarServicio({
      ...payload,
      id_pozo: payload.id_pozo ?? payload.idPozo ?? payload.pozoId ?? id
    }, currentUser);
  }

  const fields = [];
  const params = [];

  if (payload.nombre_servicio !== undefined || payload.nombreServicio !== undefined || payload.servicio !== undefined) {
    fields.push('servicio_asignado = ?');
    params.push(normalizeText(payload.nombre_servicio ?? payload.nombreServicio ?? payload.servicio));
  }

  if (payload.tipo_servicio !== undefined || payload.tipoServicio !== undefined) {
    fields.push('tipo_servicio = ?');
    params.push(normalizeText(payload.tipo_servicio ?? payload.tipoServicio));
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

    params.push(idPozo);

    await conn.query(
      `
        UPDATE pozo_servicio_asignacion
        SET ${fields.join(', ')}
        WHERE id_pozo = ?
          AND LOWER(estado_asignacion) IN (${activeStatusesPlaceholders()})
      `,
      [...params, ...ACTIVE_SERVICE_STATUSES]
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
