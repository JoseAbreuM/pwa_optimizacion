function normalizeOfflineOperation(body = {}) {
  return {
    ...body,
    receivedAt: new Date().toISOString()
  };
}

module.exports = {
  normalizeOfflineOperation
};
