const { resolveRoleByDepartment } = require('../middleware/auth');

function renderLogin(req, res) {
  if (req.session.user) return res.redirect('/');
  return res.render('auth/login', { title: 'Acceso plataforma', error: null, layout: 'layouts/authLayout' });
}

function login(req, res) {
  const { username, department, role } = req.body;
  if (!username || !department || !role) {
    return res.status(400).render('auth/login', {
      title: 'Acceso plataforma',
      layout: 'layouts/authLayout',
      error: 'Completa usuario, departamento y rol.'
    });
  }

  const allowedRoles = resolveRoleByDepartment(department);
  if (!allowedRoles.includes(role)) {
    return res.status(403).render('auth/login', {
      title: 'Acceso plataforma',
      layout: 'layouts/authLayout',
      error: 'El rol no corresponde al departamento seleccionado.'
    });
  }

  req.session.user = {
    username,
    department,
    role
  };

  return res.redirect('/');
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = {
  renderLogin,
  login,
  logout
};
