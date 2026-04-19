function getDashboardContext(currentUser) {
  return {
    title: 'Dashboard',
    currentUser: currentUser || null,
    currentSection: 'dashboard',
    layout: 'layouts/mainLayout'
  };
}

module.exports = {
  getDashboardContext
};