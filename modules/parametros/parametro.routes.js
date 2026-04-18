const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const parametroController = require('./parametro.controller');

const router = express.Router();
router.get('/', ensureAuthenticated, parametroController.index);

module.exports = router;
