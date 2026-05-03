const pozoService = require('./pozo.service');

/**
 * Renderiza el listado principal de pozos.
 */
async function list(req, res, next) {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      area: String(req.query.area || '').trim(),
      estado: String(req.query.estado || '').trim()
    };

    const [pozos, options] = await Promise.all([
      pozoService.listPozos(filters),
      pozoService.getFilterOptions()
    ]);

    return res.render('modules/pozos/index', {
      title: 'Pozos',
      pozos,
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
 * Renderiza la ficha/detalle del pozo.
 *
 * Carga:
 * - Datos generales
 * - Bomba actual
 * - Historial de bombas
 * - Último parámetro
 * - Último nivel
 * - Últimas muestras
 * - Timeline compacto
 * - Survey activo
 */
async function detail(req, res, next) {
  try {
    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).render('errors/404', {
        title: 'Pozo no encontrado',
        layout: 'layouts/mainLayout',
        currentSection: 'pozos'
      });
    }

    const [
      bombaActual,
      historialBombas,
      ultimoParametro,
      ultimoNivel,
      ultimasMuestras,
      timeline,
      survey
    ] = await Promise.all([
      pozoService.getBombaActualByPozo(pozo.id),
      pozoService.getHistorialBombasByPozo(pozo.id),
      pozoService.getUltimoParametroByPozo(pozo.id),
      pozoService.getUltimoNivelByPozo(pozo.id),
      pozoService.getUltimasMuestrasByPozo(pozo.id, 10),
      pozoService.getPozoTimeline(pozo.id),
      pozoService.getSurveyActivoByPozo(pozo.id)
    ]);

    /**
     * Regla operacional:
     * Las velocidades vigentes salen del último parámetro registrado.
     * Si todavía no existe un parámetro con velocidades, se usa el dato
     * guardado en pozos como respaldo.
     */
    const velocidades = {
      operacional: ultimoParametro?.vel_operacional ?? pozo.vel_operacional ?? null,
      actual: ultimoParametro?.vel_actual ?? pozo.vel_actual ?? pozo.rpm ?? null
    };

    return res.render('modules/pozos/detalle', {
      title: `Pozo ${pozo.codigo}`,
      pozo,
      bombaActual,
      historialBombas,
      ultimoParametro,
      ultimoNivel,
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
 * API del listado de pozos.
 */
async function listApi(req, res, next) {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      area: String(req.query.area || '').trim(),
      estado: String(req.query.estado || '').trim()
    };

    const pozos = await pozoService.listPozos(filters);

    return res.json({
      ok: true,
      data: pozos
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
    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    const [
      bombaActual,
      historialBombas,
      ultimoParametro,
      ultimoNivel,
      ultimasMuestras,
      timeline,
      survey
    ] = await Promise.all([
      pozoService.getBombaActualByPozo(pozo.id),
      pozoService.getHistorialBombasByPozo(pozo.id),
      pozoService.getUltimoParametroByPozo(pozo.id),
      pozoService.getUltimoNivelByPozo(pozo.id),
      pozoService.getUltimasMuestrasByPozo(pozo.id, 10),
      pozoService.getPozoTimeline(pozo.id),
      pozoService.getSurveyActivoByPozo(pozo.id)
    ]);

    const velocidades = {
      operacional: ultimoParametro?.vel_operacional ?? pozo.vel_operacional ?? null,
      actual: ultimoParametro?.vel_actual ?? pozo.vel_actual ?? pozo.rpm ?? null
    };

    return res.json({
      ok: true,
      data: {
        pozo,
        bombaActual,
        historialBombas,
        ultimoParametro,
        ultimoNivel,
        ultimasMuestras,
        timeline,
        survey,
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

module.exports = {
  list,
  detail,
  listApi,
  detailApi,
  getSurvey,
  updateSurvey,
  actualizarPotencialPozo
};