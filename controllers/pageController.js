function dashboard(req, res) {
  res.render('index', {
    title: 'Operacion de Campo',
    user: req.session.user
  });
}

function optimizacion(req, res) {
  res.render('dashboards/optimizacion', {
    title: 'Dashboard Optimizacion',
    user: req.session.user
  });
}

function operaciones(req, res) {
  res.render('dashboards/operaciones', {
    title: 'Dashboard Operaciones',
    user: req.session.user
  });
}

function mantenimiento(req, res) {
  res.render('dashboards/mantenimiento', {
    title: 'Dashboard Mantenimiento',
    user: req.session.user
  });
}

module.exports = {
  dashboard,
  optimizacion,
  operaciones,
  mantenimiento
};
