const nivelService = require('./nivel.service');

async function index(req, res, next) {
  try {
    const niveles = await nivelService.listNiveles();
    return res.render('modules/niveles/index', {
      title: 'Tomas de nivel',
      currentSection: 'niveles',
      niveles,
      layout: 'layouts/mainLayout'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
