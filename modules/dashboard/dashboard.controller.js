const dashboardService = require('./dashboard.service');

function index(req, res) {
  return res.render('index', dashboardService.getDashboardContext(req.session.user));
}

function optimizacion(req, res) {
  return index(req, res);
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