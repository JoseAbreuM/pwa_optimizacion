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
 *
 * Actualiza datos simples del pozo:
 * estado, categoría, zona/área, potencial, nota, coordenadas,
 * diagrama, fecha_arranque, alto corte de agua, etc.
 */
router.patch('/pozos/:id', mapaApiAuth, mapaController.updatePozo);

/**
 * POST /api/mapa/servicios/asignar
 *
 * Asigna o mueve un servicio a un pozo.
 *
 * Payload esperado flexible:
 * {
 *   id_pozo: 64,
 *   servicio: "RIG-351",
 *   estadoAnterior: "Activo"
 * }
 *
 * O:
 * {
 *   pozo: { id: "MFB-0760", dbId: 64 },
 *   servicio: "RIG-351",
 *   estadoAnterior: "Activo"
 * }
 *
 * Si el servicio estaba en otro pozo, el backend cierra esa asignación
 * y actualiza el pozo saliente con estadoAnterior/estadoSaliente.
 */
router.post('/servicios/asignar', mapaApiAuth, mapaController.asignarServicio);

/**
 * POST /api/mapa/servicios/desasignar
 *
 * Desasigna un servicio por pozo o por nombre de servicio.
 *
 * Payload:
 * {
 *   id_pozo: 64,
 *   estadoFinal: "Activo"
 * }
 *
 * O:
 * {
 *   servicio: "RIG-351",
 *   estadoFinal: "Activo"
 * }
 */
router.post('/servicios/desasignar', mapaApiAuth, mapaController.desasignarServicio);

/**
 * PATCH /api/mapa/servicios/:id/desasignar
 *
 * Compatibilidad para desasignar usando :id como id_pozo.
 */
router.patch('/servicios/:id/desasignar', mapaApiAuth, mapaController.desasignarServicio);

/**
 * PATCH /api/mapa/servicios/:id
 *
 * Actualiza una asignación activa.
 *
 * Si recibe:
 * {
 *   activo: false
 * }
 *
 * o:
 * {
 *   estado_asignacion: "cerrado"
 * }
 *
 * o:
 * {
 *   action: "desasignar"
 * }
 *
 * se interpreta como desasignación.
 */
router.patch('/servicios/:id', mapaApiAuth, mapaController.updateServicioAsignado);

module.exports = router;