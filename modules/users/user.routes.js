const express = require('express');
const userController = require('./user.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

router.get('/', ensureAuthenticated, (req, res) => res.redirect('/usuarios/crear'));
router.get('/crear', ensureAuthenticated, userController.renderCreateUser);
router.post('/crear', ensureAuthenticated, userController.createUser);

module.exports = router;
