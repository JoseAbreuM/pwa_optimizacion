const express = require('express');
const mapaController = require('./mapa.controller');
const { mapaApiAuth } = require('../../middleware/mapaApiAuth');

const router = express.Router();

/**
 * Lectura pública para mapaBare.
 *
 * Estos endpoints pueden consumirse desde:
 * https://mapa-trillas-bare.web.app
 *
 * No usan sesión porque el mapa está alojado en otro dominio
 * y no comparte cookies con la PWA de Render.
 */

/**
 * GET /api/mapa/health
 */
router.get('/health', mapaController.health);

/**
 * GET /api/mapa/pozos
 */
router.get('/pozos', mapaController.listPozos);

/**
 * GET /api/mapa/pozos/:id
 */
router.get('/pozos/:id', mapaController.getPozo);

/**
 * GET /api/mapa/servicios
 */
router.get('/servicios', mapaController.listServicios);

/**
 * Escritura protegida por token API.
 *
 * El mapa debe enviar:
 * Authorization: Bearer <MAPA_API_TOKEN>
 *
 * El token debe existir en Render como variable de entorno:
 * MAPA_API_TOKEN=...
 */

/**
 * PATCH /api/mapa/pozos/:id
 */
router.patch('/pozos/:id', mapaApiAuth, mapaController.updatePozo);

/**
 * POST /api/mapa/servicios/asignar
 */
router.post('/servicios/asignar', mapaApiAuth, mapaController.asignarServicio);

/**
 * PATCH /api/mapa/servicios/:id
 */
router.patch('/servicios/:id', mapaApiAuth, mapaController.updateServicioAsignado);

module.exports = router;