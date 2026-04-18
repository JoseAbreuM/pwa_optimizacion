const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const muestraController = require('./muestra.controller');

const router = express.Router();
router.get('/', ensureAuthenticated, muestraController.index);

module.exports = router;
