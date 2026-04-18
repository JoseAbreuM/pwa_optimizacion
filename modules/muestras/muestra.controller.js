const muestraService = require('./muestra.service');

async function index(req, res, next) {
  try {
    const muestras = await muestraService.listMuestras();
    return res.render('modules/muestras/index', {
      title: 'Muestras',
      currentSection: 'muestras',
      muestras,
      layout: 'layouts/mainLayout'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
