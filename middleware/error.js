function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { title: 'No encontrado' });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).render('errors/500', {
    title: 'Error interno',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ocurrio un error inesperado.'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
