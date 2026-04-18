const express = require('express');
const pozoController = require('./pozo.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

router.get('/', ensureAuthenticated, pozoController.list);
router.get('/data', ensureAuthenticated, pozoController.listApi);
router.get('/:id', ensureAuthenticated, pozoController.detail);
router.get('/:id/data', ensureAuthenticated, pozoController.detailApi);

module.exports = router;
