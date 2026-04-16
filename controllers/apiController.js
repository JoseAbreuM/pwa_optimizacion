const { buildSyncPayload } = require('../services/syncService');

function getBootstrapData(req, res) {
  const seed = {
    timestamp: new Date().toISOString(),
    pozos: [],
    bombas: [],
    parametrosDiarios: [],
    niveles: [],
    muestras: []
  };

  res.json(seed);
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
