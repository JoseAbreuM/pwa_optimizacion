const mapaService = require('./mapa.service');

function getCurrentUser(req) {
  return req.mapaApiUser || req.session?.user || req.user || null;
}

async function health(req, res, next) {
  try {
    const result = await mapaService.health();

    return res.json({
      ok: true,
      module: 'mapa',
      ...result
    });
  } catch (error) {
    return next(error);
  }
}

async function listPozos(req, res, next) {
  try {
    const filters = {
      area: String(req.query.area || '').trim(),
      estado: String(req.query.estado || '').trim(),
      categoria: String(req.query.categoria || '').trim(),
      search: String(req.query.search || '').trim(),

      /**
       * Por defecto el mapa debe recibir todos los pozos.
       * includeDiferidos=0 permite ocultar diferidos si alguna vista lo necesita.
       */
      includeDiferidos: String(req.query.includeDiferidos || '1') === '1'
    };

    const pozos = await mapaService.listPozos(filters);

    return res.json({
      ok: true,
      total: pozos.length,
      pozos
    });
  } catch (error) {
    return next(error);
  }
}

async function getPozo(req, res, next) {
  try {
    const pozo = await mapaService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    return res.json({
      ok: true,
      pozo
    });
  } catch (error) {
    return next(error);
  }
}

async function updatePozo(req, res, next) {
  try {
    const result = await mapaService.updatePozo(
      req.params.id,
      req.body || {},
      getCurrentUser(req)
    );

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json({
      ok: true,
      message: 'Pozo actualizado correctamente.',
      pozo: result.pozo || null
    });
  } catch (error) {
    return next(error);
  }
}

async function listServicios(req, res, next) {
  try {
    const servicios = await mapaService.listServicios();

    return res.json({
      ok: true,
      total: servicios.length,
      servicios
    });
  } catch (error) {
    return next(error);
  }
}

async function asignarServicio(req, res, next) {
  try {
    const result = await mapaService.asignarServicio(
      req.body || {},
      getCurrentUser(req)
    );

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json({
      ok: true,
      message: 'Servicio asignado correctamente.',

      /**
       * Pozo destino que quedó En servicio.
       */
      pozo: result.pozo || null,

      /**
       * Pozos que tenían ese servicio antes y fueron cerrados/actualizados.
       * Esto permite que mapaBare actualice también el marcador saliente.
       */
      pozosSalientes: result.pozosSalientes || [],

      /**
       * Cantidad de servicios cerrados que tenía previamente el pozo destino.
       */
      serviciosCerradosDestino: result.serviciosCerradosDestino || 0,

      id: result.id || null
    });
  } catch (error) {
    return next(error);
  }
}

async function desasignarServicio(req, res, next) {
  try {
    const body = req.body || {};

    const payload = {
      ...body,

      /**
       * Permite usar:
       * PATCH /api/mapa/servicios/:id/desasignar
       * donde :id puede ser id_pozo si el mapa no maneja id de asignación.
       *
       * En POST /api/mapa/servicios/desasignar no hay :id,
       * así que se respeta lo enviado en el body.
       */
      id_pozo: body.id_pozo ?? body.idPozo ?? body.pozoId ?? req.params.id
    };

    const result = await mapaService.desasignarServicio(
      payload,
      getCurrentUser(req)
    );

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json({
      ok: true,
      message: 'Servicio desasignado correctamente.',

      /**
       * Lista de pozos afectados. Normalmente será 1,
       * pero puede ser más si se desasigna por nombre de servicio.
       */
      pozos: result.pozos || []
    });
  } catch (error) {
    return next(error);
  }
}

async function updateServicioAsignado(req, res, next) {
  try {
    const result = await mapaService.updateServicioAsignado(
      req.params.id,
      req.body || {},
      getCurrentUser(req)
    );

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json({
      ok: true,
      message: 'Servicio actualizado correctamente.',
      pozo: result.pozo || null,
      pozos: result.pozos || []
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  health,
  listPozos,
  getPozo,
  updatePozo,
  listServicios,
  asignarServicio,
  desasignarServicio,
  updateServicioAsignado
};