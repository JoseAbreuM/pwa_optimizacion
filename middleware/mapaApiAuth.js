function mapaApiAuth(req, res, next) {
  const expectedToken = process.env.MAPA_API_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      ok: false,
      message: 'MAPA_API_TOKEN no está configurado en el servidor.'
    });
  }

  /**
   * El mapaBare debe enviar:
   * Authorization: Bearer <MAPA_API_TOKEN>
   *
   * No usamos x-api-key para evitar problemas CORS con headers no permitidos.
   */
  const authHeader = String(req.headers.authorization || '').trim();

  const incomingToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

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