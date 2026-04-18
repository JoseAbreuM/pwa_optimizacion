const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const offlineController = require('./offline.controller');

const router = express.Router();

router.get('/bootstrap', ensureAuthenticated, offlineController.getBootstrapData);
router.post('/sync/operation', ensureAuthenticated, offlineController.receiveOfflineOperation);

module.exports = router;
