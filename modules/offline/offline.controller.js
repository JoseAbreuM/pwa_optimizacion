const offlineService = require('./offline.service');

async function getOfflineSnapshot(req, res, next) {
  try {
    const snapshot = await offlineService.buildOfflineSnapshot(req.session.user);
    return res.json({ ok: true, snapshot });
  } catch (error) {
    return next(error);
  }
}

async function syncOfflineOperations(req, res, next) {
  try {
    const operations = Array.isArray(req.body.operations)
      ? req.body.operations
      : [req.body];

    const results = [];

    for (const operation of operations) {
      const result = await offlineService.applyOfflineOperation(operation, req.session.user);
      results.push({
        localId: operation.localId || operation.id || null,
        ...result
      });
    }

    return res.json({ ok: true, results });
  } catch (error) {
    return next(error);
  }
}

async function getBootstrapData(req, res, next) {
  try {
    const snapshot = await offlineService.buildOfflineSnapshot(req.session.user);
    return res.json(snapshot);
  } catch (error) {
    return next(error);
  }
}

async function receiveOfflineOperation(req, res, next) {
  try {
    const operation = req.body;
    const result = await offlineService.applyOfflineOperation(operation, req.session.user);
    return res.status(202).json({
      ok: true,
      message: 'Operación recibida para sincronización.',
      result
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOfflineSnapshot,
  syncOfflineOperations,
  getBootstrapData,
  receiveOfflineOperation
};
