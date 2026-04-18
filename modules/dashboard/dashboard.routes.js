const express = require('express');
const dashboardController = require('./dashboard.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

router.get('/', ensureAuthenticated, dashboardController.dashboard);
router.get('/optimizacion', ensureAuthenticated, dashboardController.optimizacion);
router.get('/operaciones', ensureAuthenticated, dashboardController.operaciones);
router.get('/mantenimiento', ensureAuthenticated, dashboardController.mantenimiento);

module.exports = router;
