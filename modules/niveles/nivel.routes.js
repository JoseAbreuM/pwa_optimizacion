const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const nivelController = require('./nivel.controller');

const router = express.Router();
router.get('/', ensureAuthenticated, nivelController.index);

module.exports = router;
