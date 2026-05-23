const mapaService = require('./mapa.service');

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
    const result = await mapaService.updatePozo(req.params.id, req.body || {}, req.session.user);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
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
    const result = await mapaService.asignarServicio(req.body || {}, req.session.user);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function updateServicioAsignado(req, res, next) {
  try {
    const result = await mapaService.updateServicioAsignado(req.params.id, req.body || {}, req.session.user);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
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
  updateServicioAsignado
};