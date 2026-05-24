const express = require('express');
const mapaController = require('./mapa.controller');
const { ensureAuthenticated } = require('../../middleware/auth');

const router = express.Router();

/**
 * Lectura pública para mapaBare.
 *
 * Estos endpoints deben poder ser consumidos desde:
 * https://mapa-trillas-bare.web.app
 *
 * No usan ensureAuthenticated porque el mapa está alojado en otro dominio
 * y no comparte sesión/cookies con la PWA de Render.
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
 *
 * Público por ahora para que mapaBare pueda leer servicios activos
 * y pintar asignaciones.
 */
router.get('/servicios', mapaController.listServicios);

/**
 * Escritura protegida.
 *
 * Estas rutas sí modifican la base de datos, por eso mantienen sesión.
 * Más adelante podemos cambiarlas a token/API key para que mapaBare pueda
 * editar desde otro dominio sin depender de cookies cross-site.
 */

/**
 * PATCH /api/mapa/pozos/:id
 */
router.patch('/pozos/:id', ensureAuthenticated, mapaController.updatePozo);

/**
 * POST /api/mapa/servicios/asignar
 */
router.post('/servicios/asignar', ensureAuthenticated, mapaController.asignarServicio);

/**
 * PATCH /api/mapa/servicios/:id
 */
router.patch('/servicios/:id', ensureAuthenticated, mapaController.updateServicioAsignado);

module.exports = router;