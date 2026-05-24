function mapaApiAuth(req, res, next) {
  const expectedToken = process.env.MAPA_API_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      ok: false,
      message: 'MAPA_API_TOKEN no está configurado en el servidor.'
    });
  }

  const authHeader = String(req.headers.authorization || '').trim();

  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;

  const apiKeyToken = String(
    req.headers['x-api-key'] ||
    req.headers['x-mapa-api-token'] ||
    req.query?.token ||
    ''
  ).trim();

  const incomingToken = bearerToken || apiKeyToken;

  if (!incomingToken || incomingToken !== expectedToken) {
    return res.status(401).json({
      ok: false,
      message: 'Token API inválido o ausente.'
    });
  }

  req.mapaApiUser = {
    type: 'api-token',
    name: 'mapaBare'
  };

  return next();
}

module.exports = {
  mapaApiAuth
};