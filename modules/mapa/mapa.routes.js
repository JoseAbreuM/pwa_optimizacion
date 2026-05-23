const express = require('express');
const mapaController = require('./mapa.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

/**
 * GET /api/mapa/health
 */
router.get('/health', ensureAuthenticated, mapaController.health);

/**
 * GET /api/mapa/pozos
 */
router.get('/pozos', ensureAuthenticated, mapaController.listPozos);

/**
 * GET /api/mapa/pozos/:id
 */
router.get('/pozos/:id', ensureAuthenticated, mapaController.getPozo);

/**
 * PATCH /api/mapa/pozos/:id
 */
router.patch('/pozos/:id', ensureAuthenticated, mapaController.updatePozo);

/**
 * GET /api/mapa/servicios
 */
router.get('/servicios', ensureAuthenticated, mapaController.listServicios);

/**
 * POST /api/mapa/servicios/asignar
 */
router.post('/servicios/asignar', ensureAuthenticated, mapaController.asignarServicio);

/**
 * PATCH /api/mapa/servicios/:id
 */
router.patch('/servicios/:id', ensureAuthenticated, mapaController.updateServicioAsignado);

module.exports = router;