const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const { registerModuleRoutes } = require('./modules');
const { testConnection } = require('./config/db');
const { port, sessionSecret, envPath } = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const viewHelpers = require('./utils/viewHelpers');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/mainLayout');

app.use(expressLayouts);

/**
 * Helpers globales para vistas EJS.
 *
 * Uso en cualquier .ejs:
 * <%= formatDate(fecha) %>
 * <%= formatNumber(valor) %>
 * <%= fallback(valor) %>
 */
app.locals.formatDate = viewHelpers.formatDate;
app.locals.formatNumber = viewHelpers.formatNumber;
app.locals.fallback = viewHelpers.fallback;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieParser());

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
  })
);

/**
 * Variables disponibles en todas las vistas.
 */
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

registerModuleRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    const dbName = await testConnection();

    app.listen(port, () => {
      console.log(`PetroField PWA ejecutandose en http://localhost:${port}`);
      console.log(`Conexion MySQL lista sobre la base de datos: ${dbName}`);
    });
  } catch (error) {
    console.error(`No fue posible conectar con MySQL. Revisa variables de entorno en ${envPath}.`);
    console.error(error.message);
    process.exit(1);
  }
}

startServer();