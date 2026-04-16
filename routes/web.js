const express = require('express');
const authController = require('../controllers/authController');
const pageController = require('../controllers/pageController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

const router = express.Router();

router.get('/login', authController.renderLogin);
router.post('/login', authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);

router.get('/', ensureAuthenticated, pageController.dashboard);
router.get('/dashboards/optimizacion', ensureAuthenticated, ensureRole('optimizacion', 'supervisor_optimizacion'), pageController.optimizacion);
router.get('/dashboards/operaciones', ensureAuthenticated, ensureRole('operaciones', 'supervisor_operaciones'), pageController.operaciones);
router.get('/dashboards/mantenimiento', ensureAuthenticated, ensureRole('mantenimiento', 'supervisor_mantenimiento'), pageController.mantenimiento);

module.exports = router;
