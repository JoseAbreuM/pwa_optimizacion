const express = require('express');
const pozoController = require('./pozo.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

/**
 * Vista principal del módulo de pozos.
 *
 * GET /pozos
 */
router.get('/', ensureAuthenticated, pozoController.list);

/**
 * API del listado de pozos.
 *
 * GET /pozos/data
 */
router.get('/data', ensureAuthenticated, pozoController.listApi);

/**
 * Actualiza el potencial de un pozo desde la tabla principal.
 *
 * IMPORTANTE:
 * Esta ruta debe ir antes de /:id para que Express no interprete
 * "potencial" o rutas similares como si fueran IDs.
 *
 * PATCH /pozos/:id/potencial
 */
router.patch('/:id/potencial', ensureAuthenticated, pozoController.actualizarPotencialPozo);

/**
 * API para obtener el survey activo del pozo.
 *
 * GET /pozos/:id/survey
 */
router.get('/:id/survey', ensureAuthenticated, pozoController.getSurvey);

/**
 * Actualiza el survey activo del pozo pegando una tabla desde Excel.
 *
 * POST /pozos/:id/survey
 */
router.post('/:id/survey', ensureAuthenticated, pozoController.updateSurvey);

/**
 * API de detalle del pozo.
 *
 * GET /pozos/:id/data
 */
router.get('/:id/data', ensureAuthenticated, pozoController.detailApi);

/**
 * Vista detalle/ficha del pozo.
 *
 * GET /pozos/:id
 */
router.get('/:id', ensureAuthenticated, pozoController.detail);

module.exports = router;