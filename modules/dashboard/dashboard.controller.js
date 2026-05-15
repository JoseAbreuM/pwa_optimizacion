const dashboardService = require('./dashboard.service');

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

async function index(req, res, next) {
  try {
    setNoCacheHeaders(res);

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