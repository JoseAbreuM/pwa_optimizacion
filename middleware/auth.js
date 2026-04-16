const departmentRoles = {
  optimizacion: ['optimizacion', 'supervisor_optimizacion'],
  operaciones: ['operaciones', 'supervisor_operaciones'],
  mantenimiento: ['mantenimiento', 'supervisor_mantenimiento'],
  laboratorio: ['laboratorio', 'supervisor_laboratorio'],
  seguridad: ['seguridad', 'supervisor_seguridad'],
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
    return res.status(403).render('errors/noAutorizado', { title: 'Sin acceso' });
  };
}

function resolveRoleByDepartment(department) {
  const key = String(department || '').toLowerCase();
  return departmentRoles[key] || [];
}

module.exports = {
  departmentRoles,
  ensureAuthenticated,
  ensureRole,
  resolveRoleByDepartment
};
