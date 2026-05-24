function wantsJson(req) {
  return (
    req.originalUrl.startsWith('/api/') ||
    req.xhr ||
    req.headers.accept?.includes('application/json')
  );
}

function notFoundHandler(req, res) {
  if (wantsJson(req)) {
    return res.status(404).json({
      ok: false,
      message: 'Ruta no encontrada.'
    });
  }

  return res.status(404).render('errors/404', {
    title: 'No encontrado'
  });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Ocurrió un error inesperado.';

  if (wantsJson(req)) {
    return res.status(500).json({
      ok: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }

  return res.status(500).render('errors/500', {
    title: 'Error interno',
    message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};