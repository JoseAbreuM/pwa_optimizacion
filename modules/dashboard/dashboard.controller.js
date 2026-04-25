const dashboardService = require('./dashboard.service');

async function index(req, res, next) {
  try {
    const context = await dashboardService.getDashboardData(req.session.user);
    return res.render('modules/dashboard/index', context);
  } catch (error) {
    return next(error);
  }
}

function optimizacion(req, res) {
  return res.redirect('/dashboard');
}

function operaciones(req, res) {
  return res.redirect('/dashboard');
}

function mantenimiento(req, res) {
  return res.redirect('/dashboard');
}

module.exports = {
  index,
  optimizacion,
  operaciones,
  mantenimiento
};