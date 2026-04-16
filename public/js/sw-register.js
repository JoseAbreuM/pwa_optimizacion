if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => {
      console.log('Service worker registrado.');
    })
    .catch(error => {
      console.error('No se pudo registrar SW:', error);
    });
}
