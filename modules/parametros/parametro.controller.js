const parametroService = require('./parametro.service');

async function index(req, res, next) {
  try {
    const parametros = await parametroService.listParametros();
    return res.render('modules/parametros/index', {
      title: 'Parámetros diarios',
      currentSection: 'parametros',
      parametros,
      layout: 'layouts/mainLayout'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
