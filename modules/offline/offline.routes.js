const express = require('express');
const { ensureAuthenticated } = require('../../middleware/auth');
const offlineController = require('./offline.controller');

const router = express.Router();

/**
 * Descarga offline por bloques.
 *
 * Quedan montadas bajo /api porque este router se registra en modules/index.js.
 *
 * GET /api/offline/manifest
 * GET /api/offline/chunk/:store?page=1&pageSize=1000
 */
router.get('/offline/manifest', ensureAuthenticated, offlineController.getOfflineManifest);
router.get('/offline/chunk/:store', ensureAuthenticated, offlineController.getOfflineChunk);

/**
 * Snapshot anterior.
 * Lo dejamos por compatibilidad mientras migramos sync.js a descarga por chunks.
 *
 * GET /api/offline/snapshot
 */
router.get('/offline/snapshot', ensureAuthenticated, offlineController.getOfflineSnapshot);

/**
 * Sincronización de operaciones pendientes.
 *
 * POST /api/offline/sync
 */
router.post('/offline/sync', ensureAuthenticated, offlineController.syncOfflineOperations);

/**
 * Endpoints legacy / compatibilidad.
 */
router.get('/bootstrap', ensureAuthenticated, offlineController.getBootstrapData);
router.post('/sync/operation', ensureAuthenticated, offlineController.receiveOfflineOperation);

module.exports = router;