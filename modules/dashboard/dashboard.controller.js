const dashboardService = require('./dashboard.service');

function dashboard(req, res) {
  return res.render('index', dashboardService.getDashboardContext(req.session.user));
}

function optimizacion(req, res) {
  return dashboard(req, res);
}

function operaciones(req, res) {
  return res.redirect('/dashboard');
}

function mantenimiento(req, res) {
  return res.redirect('/dashboard');
}

module.exports = {
  dashboard,
  optimizacion,
  operaciones,
  mantenimiento
};
