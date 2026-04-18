function getDashboardContext(currentUser) {
  return {
    title: 'Menú principal · Optimización',
    user: currentUser,
    currentSection: 'optimizacion',
    layout: 'layouts/mainLayout'
  };
}

module.exports = {
  getDashboardContext
};
