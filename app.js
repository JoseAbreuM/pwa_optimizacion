const fs = require('fs');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const { registerModuleRoutes } = require('./modules');
const { testConnection } = require('./database/db');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const envPath = fs.existsSync(path.join(__dirname, '.env'))
  ? path.join(__dirname, '.env')
  : path.join(__dirname, 'env/.env');

dotenv.config({ path: envPath });

const app = express();
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/mainLayout');
app.use(expressLayouts);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(
	session({
		secret: process.env.SESSION_SECRET || 'petrofield-secret-dev',
		resave: false,
		saveUninitialized: false
	})
);

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
		console.error('No fue posible conectar con MySQL. Revisa env/.env y phpMyAdmin.');
		console.error(error.message);
		process.exit(1);
	}
}

startServer();
