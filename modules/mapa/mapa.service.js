const { pool } = require('../../config/db');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;

  const text = String(value || '').trim().toLowerCase();

  if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(text)) return 1;
  if (['false', '0', 'no', 'n'].includes(text)) return 0;

  return null;
}

function toMapaPozo(row) {
  return {
    id: row.id,
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

    coordsMapa: row.latitud != null && row.longitud != null
      ? [Number(row.latitud), Number(row.longitud)]
      : null,

    coords: row.coord_x != null && row.coord_y != null
      ? [Number(row.coord_x), Number(row.coord_y)]
      : null,

    coordsDiagrama: row.coord_x != null && row.coord_y != null
      ? [Number(row.coord_x), Number(row.coord_y)]
      : null,

    latitud: row.latitud,
    longitud: row.longitud,

    diagrama: row.diagrama,
    vistaMapa: Boolean(row.visible_diagrama),

    cabezal: row.cabezal,
    variador: row.variador,
    metodo: row.metodo_levantamiento,

    velocidadOperacional: row.vel_operacional,
    velocidadActual: row.vel_actual,

    servicioAsignado: row.servicio_asignado,
    tipoServicio: row.tipo_servicio,
    estadoAsignacion: row.estado_asignacion,
    fechaAsignacion: row.fecha_asignacion,
    observacionServicio: row.observacion_servicio
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

async function listPozos(filters = {}) {
  const where = [];
  const params = [];

  if (filters.area) {
    where.push('p.area = ?');
    params.push(filters.area);
  }

  if (filters.categoria) {
    where.push('p.categoria = ?');
    params.push(filters.categoria);
  }

  if (filters.estado) {
    where.push('ep.nombre = ?');
    params.push(filters.estado);
  }

  if (!filters.includeDiferidos) {
    where.push("(ep.nombre IS NULL OR ep.nombre <> 'Diferido')");
  }

  if (filters.search) {
    where.push(`(
      p.codigo LIKE ?
      OR p.area LIKE ?
      OR ep.nombre LIKE ?
      OR p.yacimiento LIKE ?
    )`);

    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.codigo,
        p.categoria,
        ep.nombre AS estado,
        p.area,
        p.yacimiento,
        p.potencial,
        p.latitud,
        p.longitud,
        p.alto_corte_agua,
        p.nota_operativa,
        p.vel_operacional,
        p.vel_actual,

        pd.diagrama,
        pd.coord_x,
        pd.coord_y,
        pd.visible AS visible_diagrama,

        cb.nombre AS cabezal,
        vd.nombre AS variador,
        ml.nombre AS metodo_levantamiento,

        psa.id AS servicio_asignado_id,
        psa.nombre_servicio AS servicio_asignado,
        psa.tipo_servicio,
        psa.estado_asignacion,
        psa.fecha_asignacion,
        psa.observacion AS observacion_servicio

      FROM pozos p
      LEFT JOIN estado_pozo ep
        ON ep.id = p.id_estado
      LEFT JOIN pozos_diagrama pd
        ON pd.id_pozo = p.id
      LEFT JOIN cabezales cb
        ON cb.id = p.id_cabezal
      LEFT JOIN vdfs vd
        ON vd.id = p.id_vdf
      LEFT JOIN metodos_levantamiento ml
        ON ml.id = p.id_metodo_levantamiento
      LEFT JOIN pozo_servicios_asignados psa
        ON psa.id_pozo = p.id
       AND psa.activo = 1

      ${whereSql}

      ORDER BY p.codigo ASC
    `,
    params
  );

  return rows.map(toMapaPozo);
}

async function getPozoById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.codigo,
        p.categoria,
        ep.nombre AS estado,
        p.area,
        p.yacimiento,
        p.potencial,
        p.latitud,
        p.longitud,
        p.alto_corte_agua,
        p.nota_operativa,
        p.vel_operacional,
        p.vel_actual,

        pd.diagrama,
        pd.coord_x,
        pd.coord_y,
        pd.visible AS visible_diagrama,

        cb.nombre AS cabezal,
        vd.nombre AS variador,
        ml.nombre AS metodo_levantamiento,

        psa.id AS servicio_asignado_id,
        psa.nombre_servicio AS servicio_asignado,
        psa.tipo_servicio,
        psa.estado_asignacion,
        psa.fecha_asignacion,
        psa.observacion AS observacion_servicio

      FROM pozos p
      LEFT JOIN estado_pozo ep
        ON ep.id = p.id_estado
      LEFT JOIN pozos_diagrama pd
        ON pd.id_pozo = p.id
      LEFT JOIN cabezales cb
        ON cb.id = p.id_cabezal
      LEFT JOIN vdfs vd
        ON vd.id = p.id_vdf
      LEFT JOIN metodos_levantamiento ml
        ON ml.id = p.id_metodo_levantamiento
      LEFT JOIN pozo_servicios_asignados psa
        ON psa.id_pozo = p.id
       AND psa.activo = 1

      WHERE p.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ? toMapaPozo(rows[0]) : null;
}

async function updatePozo(id, payload = {}, currentUser = null) {
  const idPozo = normalizeNumber(id);

  if (!idPozo) {
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
    const [estadoRows] = await pool.query(
      `
        SELECT id
        FROM estado_pozo
        WHERE BINARY nombre = BINARY ?
        LIMIT 1
      `,
      [normalizeText(payload.estado)]
    );

    if (estadoRows[0]?.id) {
      fields.push('id_estado = ?');
      params.push(estadoRows[0].id);
    }
  }

  if (fields.length) {
    fields.push('updated_at = NOW()');
    params.push(idPozo);

    await pool.query(
      `
        UPDATE pozos
        SET ${fields.join(', ')}
        WHERE id = ?
      `,
      params
    );
  }

  await updatePozoDiagrama(idPozo, payload);

  const pozo = await getPozoById(idPozo);

  return {
    ok: true,
    pozo
  };
}

async function updatePozoDiagrama(idPozo, payload = {}) {
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

  const coordX = coords ? normalizeNumber(coords[0]) : normalizeNumber(payload.coord_x);
  const coordY = coords ? normalizeNumber(coords[1]) : normalizeNumber(payload.coord_y);

  const visible = normalizeBoolean(payload.vistaMapa ?? payload.visible);

  await pool.query(
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
      ON DUPLICATE KEY UPDATE
        diagrama = COALESCE(VALUES(diagrama), diagrama),
        coord_x = COALESCE(VALUES(coord_x), coord_x),
        coord_y = COALESCE(VALUES(coord_y), coord_y),
        visible = COALESCE(VALUES(visible), visible),
        updated_at = NOW()
    `,
    [
      idPozo,
      payload.diagrama ?? null,
      coordX,
      coordY,
      visible
    ]
  );
}

async function listServicios() {
  const [rows] = await pool.query(
    `
      SELECT
        psa.id,
        psa.id_pozo,
        p.codigo AS codigo_pozo,
        psa.nombre_servicio,
        psa.tipo_servicio,
        psa.fecha_asignacion,
        psa.estado_asignacion,
        psa.observacion,
        psa.activo
      FROM pozo_servicios_asignados psa
      INNER JOIN pozos p
        ON p.id = psa.id_pozo
      WHERE psa.activo = 1
      ORDER BY psa.nombre_servicio ASC, p.codigo ASC
    `
  );

  return rows;
}

async function asignarServicio(payload = {}, currentUser = null) {
  const idPozo = normalizeNumber(payload.id_pozo ?? payload.idPozo ?? payload.pozoId);
  const nombreServicio = normalizeText(payload.nombre_servicio ?? payload.nombreServicio ?? payload.servicio);

  if (!idPozo || !nombreServicio) {
    return {
      ok: false,
      message: 'id_pozo y nombre_servicio son obligatorios.'
    };
  }

  const tipoServicio = normalizeText(payload.tipo_servicio ?? payload.tipoServicio ?? 'servicio');
  const estadoAsignacion = normalizeText(payload.estado_asignacion ?? payload.estadoAsignacion ?? 'asignado');
  const observacion = normalizeText(payload.observacion ?? payload.nota ?? '');

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
        UPDATE pozo_servicios_asignados
        SET
          activo = 0,
          estado_asignacion = 'cerrado',
          updated_at = NOW()
        WHERE id_pozo = ?
          AND activo = 1
      `,
      [idPozo]
    );

    const [result] = await conn.query(
      `
        INSERT INTO pozo_servicios_asignados (
          id_pozo,
          nombre_servicio,
          tipo_servicio,
          fecha_asignacion,
          estado_asignacion,
          observacion,
          activo,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, COALESCE(?, CURDATE()), ?, ?, 1, NOW(), NOW())
      `,
      [
        idPozo,
        nombreServicio,
        tipoServicio,
        payload.fecha_asignacion ?? payload.fechaAsignacion ?? null,
        estadoAsignacion,
        observacion || null
      ]
    );

    await conn.commit();

    return {
      ok: true,
      id: result.insertId,
      pozo: await getPozoById(idPozo)
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateServicioAsignado(id, payload = {}, currentUser = null) {
  const idServicio = normalizeNumber(id);

  if (!idServicio) {
    return {
      ok: false,
      message: 'ID de servicio inválido.'
    };
  }

  const fields = [];
  const params = [];

  if (payload.nombre_servicio !== undefined || payload.nombreServicio !== undefined) {
    fields.push('nombre_servicio = ?');
    params.push(normalizeText(payload.nombre_servicio ?? payload.nombreServicio));
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

  if (payload.activo !== undefined) {
    fields.push('activo = ?');
    params.push(normalizeBoolean(payload.activo));
  }

  if (payload.fecha_asignacion !== undefined || payload.fechaAsignacion !== undefined) {
    fields.push('fecha_asignacion = ?');
    params.push(payload.fecha_asignacion ?? payload.fechaAsignacion);
  }

  if (!fields.length) {
    return {
      ok: false,
      message: 'No hay campos para actualizar.'
    };
  }

  fields.push('updated_at = NOW()');
  params.push(idServicio);

  await pool.query(
    `
      UPDATE pozo_servicios_asignados
      SET ${fields.join(', ')}
      WHERE id = ?
    `,
    params
  );

  return {
    ok: true,
    id: idServicio
  };
}

module.exports = {
  health,
  listPozos,
  getPozoById,
  updatePozo,
  listServicios,
  asignarServicio,
  updateServicioAsignado
};