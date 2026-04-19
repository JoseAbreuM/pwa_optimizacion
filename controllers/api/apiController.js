const { buildSyncPayload } = require('../../services/sync/sync.service');
const pozoService = require('../../modules/pozos/pozo.service');

async function getBootstrapData(req, res, next) {
  try {
    const seed = await pozoService.getBootstrapData();
    return res.json(seed);
  } catch (error) {
    return next(error);
  }
}

function receiveOfflineOperation(req, res) {
  const payload = buildSyncPayload(req);
  res.status(202).json({
    ok: true,
    message: 'Operacion recibida para sincronizacion.',
    payload
  });
}

module.exports = {
  getBootstrapData,
  receiveOfflineOperation
};
