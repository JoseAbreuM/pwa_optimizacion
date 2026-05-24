const { port, sessionSecret, envPath } = require('./config/env');

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const { registerModuleRoutes } = require('./modules');
const { testConnection } = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const viewHelpers = require('./utils/viewHelpers');

const app = express();

const allowedMapOrigins = [
  'https://mapa-trillas-bare.web.app',
  'https://mapa-trillas-bare.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173'
];

const mapaCorsOptions = {
  origin(origin, callback) {
    /**
     * Permite:
     * - requests sin origin, por ejemplo abrir /api/mapa/pozos directo en navegador
     * - mapaBare publicado en Firebase Hosting
     * - entorno local de pruebas
     */
    if (!origin || allowedMapOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 204
};

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
 * CORS exclusivo para la API usada por mapaBare.
 *
 * Importante:
 * Debe ir ANTES de registerModuleRoutes(app), porque ahí se monta /api/mapa.
 */
app.use('/api/mapa', cors(mapaCorsOptions));
app.options('/api/mapa/*', cors(mapaCorsOptions));

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
      console.log(`Variables de entorno cargadas desde: ${envPath}`);
    });
  } catch (error) {
    console.error(`No fue posible conectar con MySQL. Revisa variables de entorno en ${envPath}.`);
    console.error(error.message);
    process.exit(1);
  }
}

startServer();