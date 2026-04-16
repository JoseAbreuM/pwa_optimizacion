function buildSyncPayload(req) {
  return {
    endpoint: req.originalUrl,
    method: req.method,
    body: req.body,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  buildSyncPayload
};
