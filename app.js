const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const webRouter = require('./routes/web');
const apiRouter = require('./routes/api');
const { notFoundHandler, errorHandler } = require('./middleware/error');

dotenv.config({ path: './env/.env' });

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

app.use(webRouter);
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
	console.log(`PetroField PWA ejecutandose en http://localhost:${port}`);
});
