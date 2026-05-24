function mapaApiAuth(req, res, next) {
  const expectedToken = process.env.MAPA_API_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      ok: false,
      message: 'MAPA_API_TOKEN no está configurado en el servidor.'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token || token !== expectedToken) {
    return res.status(401).json({
      ok: false,
      message: 'Token API inválido o ausente.'
    });
  }

  return next();
}

module.exports = {
  mapaApiAuth
};