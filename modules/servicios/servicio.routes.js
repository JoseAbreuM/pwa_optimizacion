const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const servicioController = require('./servicio.controller');

const router = express.Router();
router.get('/', ensureAuthenticated, servicioController.index);

module.exports = router;
