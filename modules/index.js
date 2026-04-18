const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./users/user.routes');
const dashboardRoutes = require('./dashboard/dashboard.routes');
const pozoRoutes = require('./pozos/pozo.routes');
const muestraRoutes = require('./muestras/muestra.routes');
const parametroRoutes = require('./parametros/parametro.routes');
const nivelRoutes = require('./niveles/nivel.routes');
const servicioRoutes = require('./servicios/servicio.routes');
const offlineRoutes = require('./offline/offline.routes');

function registerModuleRoutes(app) {
  app.use('/', authRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/dashboards', dashboardRoutes);
  app.use('/usuarios', userRoutes);
  app.use('/pozos', pozoRoutes);
  app.use('/muestras', muestraRoutes);
  app.use('/parametros', parametroRoutes);
  app.use('/niveles', nivelRoutes);
  app.use('/servicios', servicioRoutes);
  app.use('/api', offlineRoutes);
}

module.exports = {
  registerModuleRoutes
};
