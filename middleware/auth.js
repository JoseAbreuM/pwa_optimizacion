const departmentRoles = {
  optimizacion: ['coordinador', 'ing_dpto', 'ing_trainee'],
  parametros: ['coordinador', 'ing_dpto', 'ing_trainee'],
  toma_nivel: ['coordinador', 'ing_dpto', 'ing_trainee'],
  bcp: ['coordinador', 'ing_dpto', 'ing_trainee'],
  cabezales: ['coordinador', 'ing_dpto', 'ing_trainee'],
  admin: ['admin']
};

function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/login');
}

function ensureRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.session.user?.role;

    if (!role) return res.redirect('/login');
    if (role === 'admin' || allowedRoles.includes(role)) return next();

    return res.status(403).render('errors/noAutorizado', {
      title: 'Sin acceso',
      currentUser: req.session.user || null
    });
  };
}

function ensureCanEdit(req, res, next) {
  const user = req.session.user;

  if (!user) return res.redirect('/login');

  if (user.role === 'admin') return next();

  if (user.isReadOnly) {
    return res.status(403).render('errors/noAutorizado', {
      title: 'Sin acceso',
      currentUser: user
    });
  }

  return next();
}

function ensureCanManageUsers(req, res, next) {
  const user = req.session.user;

  if (!user) return res.redirect('/login');

  if (user.canManageUsers || user.role === 'admin' || user.role === 'coordinador') {
    return next();
  }

  return res.status(403).render('errors/noAutorizado', {
    title: 'Sin acceso',
    currentUser: user
  });
}

function ensureCanManagePersonal(req, res, next) {
  const user = req.session.user;

  if (!user) return res.redirect('/login');

  if (user.canManagePersonal || user.role === 'admin' || user.role === 'coordinador') {
    return next();
  }

  return res.status(403).render('errors/noAutorizado', {
    title: 'Sin acceso',
    currentUser: user
  });
}

function ensureDepartmentAccess(...allowedDepartments) {
  return (req, res, next) => {
    const user = req.session.user;
    const deptKey = user?.departmentKey;

    if (!user) return res.redirect('/login');
    if (user.role === 'admin') return next();

    if (allowedDepartments.includes(deptKey)) return next();

    return res.status(403).render('errors/noAutorizado', {
      title: 'Sin acceso',
      currentUser: user
    });
  };
}

function resolveRoleByDepartment(department) {
  const key = normalizeDepartmentKey(department);
  return departmentRoles[key] || [];
}

function normalizeDepartmentKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

module.exports = {
  departmentRoles,
  ensureAuthenticated,
  ensureRole,
  ensureCanEdit,
  ensureCanManageUsers,
  ensureCanManagePersonal,
  ensureDepartmentAccess,
  resolveRoleByDepartment,
  normalizeDepartmentKey
};