const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

router.get('/', ensureAuthenticated, dashboardController.index);

module.exports = router;