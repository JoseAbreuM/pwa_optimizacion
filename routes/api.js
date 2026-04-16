const express = require('express');
const { ensureAuthenticated } = require('../middleware/auth');
const apiController = require('../controllers/apiController');

const router = express.Router();

router.get('/bootstrap', ensureAuthenticated, apiController.getBootstrapData);
router.post('/sync/operation', ensureAuthenticated, apiController.receiveOfflineOperation);

module.exports = router;
