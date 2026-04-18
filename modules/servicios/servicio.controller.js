const servicioService = require('./servicio.service');

async function index(req, res, next) {
  try {
    const servicios = await servicioService.listServicios();
    return res.render('modules/servicios/index', {
      title: 'Servicios de campo',
      currentSection: 'servicios',
      servicios,
      layout: 'layouts/mainLayout'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
