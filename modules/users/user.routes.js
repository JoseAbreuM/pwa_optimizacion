const express = require('express');
const userController = require('./user.controller');

const {
  ensureAuthenticated,
  ensureCanManageUsers,
  ensureCanManagePersonal
} = require('../../middleware/auth');

const router = express.Router();

router.get('/', ensureAuthenticated, userController.renderUsersModule);

router.get('/crear', ensureAuthenticated, ensureCanManageUsers, userController.renderCreateUser);
router.post('/crear', ensureAuthenticated, ensureCanManageUsers, userController.createUser);

router.get('/personal/crear', ensureAuthenticated, ensureCanManagePersonal, userController.renderCreatePersonal);
router.post('/personal/crear', ensureAuthenticated, ensureCanManagePersonal, userController.createPersonal);

router.get('/trainee', ensureAuthenticated, ensureCanManageUsers, userController.renderTrainee);
router.post('/trainee', ensureAuthenticated, ensureCanManageUsers, userController.updateTrainee);

module.exports = router;