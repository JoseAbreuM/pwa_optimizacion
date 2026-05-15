const pozoService = require('./pozo.service');

console.log('[POZO_CONTROLLER] cargado:', __filename);
console.log('[POZO_CONTROLLER] service path:', require.resolve('./pozo.service'));
console.log('[POZO_CONTROLLER] service version:', pozoService.POZO_SERVICE_VERSION || 'SIN_VERSION');

/**
 * Renderiza el listado principal de pozos.
 *
 * Importante:
 * La tabla se llena por AJAX desde /pozos/data.
 * Aquí NO cargamos todos los pozos para evitar lentitud inicial.
 */
async function list(req, res, next) {
  try {
    const filters = getFilters(req);
    const options = await pozoService.getFilterOptions();

    return res.render('modules/pozos/index', {
      title: 'Pozos',
      pozos: [],
      filters,
      areas: options.areas,
      estados: options.estados,
      currentSection: 'pozos',
      layout: 'layouts/mainLayout',
      pageScript: '/js/modules/pozos.js'
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * API del listado de pozos.
 *
 * Fuente real de la tabla DataTables.
 */
async function listApi(req, res, next) {
  try {
    setNoCacheHeaders(res);

    const filters = getFilters(req);

    const rawPozosResult = await pozoService.listPozos(filters);
    const rawPozos = Array.isArray(rawPozosResult) ? rawPozosResult : [];
    const pozos = dedupePozos(rawPozos);

    const speedRows = pozos
      .filter((pozo) =>
        hasUsefulValue(pozo.vel_actual) ||
        hasUsefulValue(pozo.velocidad_actual) ||
        hasUsefulValue(pozo.rpm) ||
        hasUsefulValue(pozo.vel_operacional) ||
        hasUsefulValue(pozo.velocidad_operacional)
      )
      .slice(0, 10)
      .map((pozo) => ({
        id: pozo.id,
        codigo: pozo.codigo,
        estado: pozo.estado,
        vel_actual: pozo.vel_actual,
        velocidad_actual: pozo.velocidad_actual,
        rpm: pozo.rpm,
        vel_operacional: pozo.vel_operacional,
        velocidad_operacional: pozo.velocidad_operacional,
        ultima_parametrizacion: pozo.ultima_parametrizacion
      }));

    const sample =
      speedRows[0] ||
      pozos.find((pozo) =>
        hasUsefulValue(pozo.vel_actual) ||
        hasUsefulValue(pozo.vel_operacional) ||
        hasUsefulValue(pozo.rpm)
      ) ||
      pozos.find((pozo) =>
        hasUsefulValue(pozo.variador) ||
        hasUsefulValue(pozo.cabezal) ||
        hasUsefulValue(pozo.variador_capacidad)
      ) ||
      pozos[0] ||
      null;

    const payload = {
      ok: true,
      controllerFile: __filename,
      serviceVersion: pozoService.POZO_SERVICE_VERSION || 'SIN_VERSION',
      serviceFile: require.resolve('./pozo.service'),
      total: pozos.length,
      rawTotal: rawPozos.length,
      filters,
      duplicateStats: getDuplicateStats(rawPozos),
      speedRows,
      sample,
      data: pozos
    };

    console.log('[POZOS/DATA] controller file:', payload.controllerFile);
    console.log('[POZOS/DATA] service version:', payload.serviceVersion);
    console.log('[POZOS/DATA] service file:', payload.serviceFile);
    console.log('[POZOS/DATA] raw total:', payload.rawTotal);
    console.log('[POZOS/DATA] total:', payload.total);
    console.log('[POZOS/DATA] duplicate stats:', payload.duplicateStats);
    console.log('[POZOS/DATA] speed rows:', payload.speedRows);

    return res.json(payload);
  } catch (error) {
    console.error('[POZOS/DATA] error:', error);
    return next(error);
  }
}

/**
 * Renderiza la ficha/detalle del pozo.
 */
async function detail(req, res, next) {
  try {
    const bootstrap = await pozoService.getBootstrapData(req.params.id);

    if (!bootstrap || !bootstrap.pozo) {
      return res.status(404).render('errors/404', {
        title: 'Pozo no encontrado',
        layout: 'layouts/mainLayout',
        currentSection: 'pozos'
      });
    }

    const {
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
    } = bootstrap;

    const velocidades = buildVelocidades(pozo, ultimoParametro);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[POZO/DETAIL] pozo:', {
        id: pozo.id,
        codigo: pozo.codigo,
        vel_actual: pozo.vel_actual,
        velocidad_actual: pozo.velocidad_actual,
        rpm: pozo.rpm,
        vel_operacional: pozo.vel_operacional,
        velocidad_operacional: pozo.velocidad_operacional,
        variador: pozo.variador,
        variador_capacidad: pozo.variador_capacidad,
        variador_potencia_hp: pozo.variador_potencia_hp
      });

      console.log('[POZO/DETAIL] ultimoParametro:', {
        fecha: ultimoParametro?.fecha,
        vel_actual: ultimoParametro?.vel_actual,
        velocidad_actual: ultimoParametro?.velocidad_actual,
        vel_operacional: ultimoParametro?.vel_operacional,
        velocidad_operacional: ultimoParametro?.velocidad_operacional,
        rpm: ultimoParametro?.rpm
      });

      console.log('[POZO/DETAIL] velocidades:', velocidades);
    }

    return res.render('modules/pozos/detalle', {
      title: `Pozo ${pozo.codigo}`,
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
      survey,
      velocidades,

      currentSection: 'pozos',
      layout: 'layouts/mainLayout',
      pageScript: '/js/modules/pozo-detalle.js'
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * API del detalle del pozo.
 */
async function detailApi(req, res, next) {
  try {
    setNoCacheHeaders(res);

    const bootstrap = await pozoService.getBootstrapData(req.params.id);

    if (!bootstrap || !bootstrap.pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    const velocidades = buildVelocidades(
      bootstrap.pozo,
      bootstrap.ultimoParametro
    );

    return res.json({
      ok: true,
      serviceVersion: pozoService.POZO_SERVICE_VERSION || 'SIN_VERSION',
      serviceFile: require.resolve('./pozo.service'),
      data: {
        ...bootstrap,
        velocidades
      }
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * API para obtener el survey activo del pozo.
 */
async function getSurvey(req, res, next) {
  try {
    setNoCacheHeaders(res);

    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    const survey = await pozoService.getSurveyActivoByPozo(pozo.id);

    return res.json({
      ok: true,
      data: survey
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * API para reemplazar el survey activo del pozo.
 *
 * Espera req.body.survey_text con una tabla pegada desde Excel:
 * MD | TVD | x-offset | y-offset
 */
async function updateSurvey(req, res) {
  try {
    setNoCacheHeaders(res);

    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    const pastedText = req.body.survey_text;

    if (!pastedText || !String(pastedText).trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Debes pegar la tabla de survey.'
      });
    }

    const result = await pozoService.replaceSurveyActivoByPozo(pozo.id, pastedText);
    const survey = await pozoService.getSurveyActivoByPozo(pozo.id);

    return res.json({
      ok: true,
      message: 'Survey actualizado correctamente.',
      result,
      data: survey
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error.message || 'No se pudo actualizar el survey.'
    });
  }
}

/**
 * API para actualizar el potencial del pozo desde la tabla principal.
 *
 * Espera:
 * - req.params.id
 * - req.body.potencial
 */
async function actualizarPotencialPozo(req, res) {
  try {
    setNoCacheHeaders(res);

    const { id } = req.params;
    const { potencial } = req.body;

    const result = await pozoService.updatePozoPotencial(id, potencial);

    if (!result.affectedRows) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el pozo para actualizar.'
      });
    }

    return res.json({
      ok: true,
      message: 'Potencial actualizado correctamente.',
      potencial: result.potencial
    });
  } catch (error) {
    console.error('Error actualizando potencial del pozo:', error);

    return res.status(400).json({
      ok: false,
      message: error.message || 'No se pudo actualizar el potencial.'
    });
  }
}

/**
 * Diagnóstico temporal del listado.
 *
 * Úsalo desde una ruta como:
 * GET /pozos/debug/service
 */
async function __debugListPozos(req, res, next) {
  try {
    setNoCacheHeaders(res);

    const rowsResult = await pozoService.listPozos({});
    const rows = Array.isArray(rowsResult) ? rowsResult : [];

    const speedRows = rows
      .filter((pozo) =>
        hasUsefulValue(pozo.vel_actual) ||
        hasUsefulValue(pozo.velocidad_actual) ||
        hasUsefulValue(pozo.rpm) ||
        hasUsefulValue(pozo.vel_operacional) ||
        hasUsefulValue(pozo.velocidad_operacional)
      )
      .slice(0, 10)
      .map((pozo) => ({
        id: pozo.id,
        codigo: pozo.codigo,
        estado: pozo.estado,
        vel_actual: pozo.vel_actual,
        velocidad_actual: pozo.velocidad_actual,
        rpm: pozo.rpm,
        vel_operacional: pozo.vel_operacional,
        velocidad_operacional: pozo.velocidad_operacional,
        ultima_parametrizacion: pozo.ultima_parametrizacion
      }));

    return res.json({
      ok: true,
      controllerFile: __filename,
      serviceFile: require.resolve('./pozo.service'),
      serviceVersion: pozoService.POZO_SERVICE_VERSION || 'SIN_VERSION',
      total: rows.length,
      duplicateStats: getDuplicateStats(rows),
      speedRows,
      sample: speedRows[0] || rows[0] || null
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Helpers
 */
function getFilters(req) {
  return {
    search: String(req.query.search || '').trim(),
    area: String(req.query.area || '').trim(),
    estado: String(req.query.estado || '').trim()
  };
}

function setNoCacheHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });
}

function buildVelocidades(pozo, ultimoParametro) {
  return {
    operacional:
      firstUsefulValue([
        ultimoParametro?.vel_operacional,
        ultimoParametro?.velocidad_operacional,
        pozo?.vel_operacional,
        pozo?.velocidad_operacional
      ]),

    actual:
      firstUsefulValue([
        ultimoParametro?.vel_actual,
        ultimoParametro?.velocidad_actual,
        ultimoParametro?.rpm,
        pozo?.vel_actual,
        pozo?.velocidad_actual,
        pozo?.rpm
      ])
  };
}

function dedupePozos(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const key = String(row.id ?? row.codigo ?? '').trim();

    if (!key) continue;

    const normalizedRow = normalizePozoListRow(row);
    const current = map.get(key);

    if (!current) {
      map.set(key, normalizedRow);
      continue;
    }

    map.set(key, mergePozoRows(current, normalizedRow));
  }

  return Array.from(map.values()).sort((a, b) => {
    const areaA = String(a.area || '');
    const areaB = String(b.area || '');
    const codigoA = String(a.codigo || '');
    const codigoB = String(b.codigo || '');

    const areaCompare = areaA.localeCompare(areaB, 'es', {
      numeric: true,
      sensitivity: 'base'
    });

    if (areaCompare !== 0) return areaCompare;

    return codigoA.localeCompare(codigoB, 'es', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

function mergePozoRows(base, incoming) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (!hasUsefulValue(merged[key]) && hasUsefulValue(value)) {
      merged[key] = value;
      continue;
    }

    if (isPreferredMergeField(key) && isBetterValue(value, merged[key])) {
      merged[key] = value;
    }
  }

  return normalizePozoListRow(merged);
}

function normalizePozoListRow(row = {}) {
  const estado = String(row.estado || '').trim();

  const velActual = firstUsefulValue([
    row.vel_actual,
    row.velocidad_actual,
    row.rpm
  ]);

  const velOperacional = firstUsefulValue([
    row.vel_operacional,
    row.velocidad_operacional
  ]);

  const estadoColor = getEstadoColor(estado);

  return {
    ...row,

    estado,

    estado_color: estadoColor,
    color_estado_mapa: estadoColor,

    vel_actual: velActual,
    velocidad_actual: velActual,
    rpm: velActual,

    vel_operacional: velOperacional,
    velocidad_operacional: velOperacional,

    cabezal: cleanDisplayValue(row.cabezal),
    variador: cleanDisplayValue(row.variador),
    variador_capacidad: cleanDisplayValue(row.variador_capacidad),
    variador_potencia_hp: row.variador_potencia_hp
  };
}

function isPreferredMergeField(key) {
  return [
    'vel_actual',
    'velocidad_actual',
    'rpm',
    'vel_operacional',
    'velocidad_operacional',
    'cabezal',
    'variador',
    'variador_capacidad',
    'variador_potencia_hp',
    'bomba_marca',
    'bomba_modelo',
    'serial_rotor',
    'bomba_fecha_instalacion',
    'bomba_tvu_dias',
    'ultima_parametrizacion'
  ].includes(key);
}

function getEstadoColor(estado) {
  const clean = normalizeText(estado);

  if (clean.includes('candidato')) return '#ef4444';
  if (clean === 'en servicio') return '#f59e0b';
  if (clean.includes('espera')) return '#64748b';
  if (clean.includes('diferido')) return '#ef4444';
  if (clean.includes('diagnostico')) return '#9333ea';
  if (clean.includes('activo')) return '#22c55e';

  return '#033F73';
}

function firstUsefulValue(values = []) {
  for (const value of values) {
    if (hasUsefulValue(value)) {
      return value;
    }
  }

  return null;
}

function isBetterValue(candidate, current) {
  if (!hasUsefulValue(candidate)) return false;
  if (!hasUsefulValue(current)) return true;

  const candidateText = String(candidate).trim();
  const currentText = String(current).trim();

  if (isWeakValue(currentText) && !isWeakValue(candidateText)) return true;

  return false;
}

function hasValue(value) {
  return value !== null &&
    value !== undefined &&
    String(value).trim() !== '';
}

function hasUsefulValue(value) {
  if (!hasValue(value)) return false;

  const clean = String(value).trim();

  return !isWeakValue(clean);
}

function isWeakValue(value) {
  const clean = String(value || '').trim().toLowerCase();

  return clean === '-' ||
    clean === '.' ||
    clean === ',' ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === 'sin dato' ||
    clean === 'sin datos';
}

function cleanDisplayValue(value) {
  if (!hasUsefulValue(value)) return null;

  return String(value).trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getDuplicateStats(rows = []) {
  const counts = new Map();

  for (const row of rows) {
    const key = String(row.id ?? row.codigo ?? '').trim();
    if (!key) continue;

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const topDuplicated = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  return {
    distinct: counts.size,
    duplicatedCount: topDuplicated.length,
    topDuplicated
  };
}

module.exports = {
  list,
  detail,
  listApi,
  detailApi,
  getSurvey,
  updateSurvey,
  actualizarPotencialPozo,
  __debugListPozos
};