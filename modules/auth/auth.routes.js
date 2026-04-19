const express = require('express');
const authController = require('./auth.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authController.redirectRoot);
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);

module.exports = router;