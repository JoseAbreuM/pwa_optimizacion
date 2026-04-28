const pozoService = require('./pozo.service');

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

async function detail(req, res, next) {
  try {
    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).render('errors/404', {
        title: 'Pozo no encontrado',
        layout: 'layouts/mainLayout'
      });
    }

    const timeline = await pozoService.getPozoTimeline(pozo.id);

    return res.render('modules/pozos/detalle', {
      title: `Pozo ${pozo.codigo}`,
      pozo,
      timeline,
      currentSection: 'pozos',
      layout: 'layouts/mainLayout'
    });
  } catch (error) {
    return next(error);
  }
}

async function listApi(req, res, next) {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      area: String(req.query.area || '').trim(),
      estado: String(req.query.estado || '').trim()
    };

    const pozos = await pozoService.listPozos(filters);
    return res.json({ ok: true, data: pozos });
  } catch (error) {
    return next(error);
  }
}

async function detailApi(req, res, next) {
  try {
    const pozo = await pozoService.getPozoById(req.params.id);

    if (!pozo) {
      return res.status(404).json({
        ok: false,
        message: 'Pozo no encontrado.'
      });
    }

    const timeline = await pozoService.getPozoTimeline(pozo.id);

    return res.json({
      ok: true,
      data: {
        pozo,
        timeline
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  detail,
  listApi,
  detailApi
};