const { departmentRoles } = require('../../middleware/auth');
const userService = require('./user.service');

async function renderCreateUserForm(req, res, options = {}) {
  const departments = await userService.loadDepartments();

  return res.render('modules/users/crear', {
    title: 'Crear usuario',
    layout: req.session.user ? 'layouts/mainLayout' : 'layouts/auth-layout',
    currentSection: 'usuarios',
    error: options.error || null,
    success: options.success || null,
    departments,
    roles: userService.getRoleOptions(),
    formData: options.formData || {
      username: '',
      department: 'admin',
      role: 'admin'
    }
  });
}

async function renderCreateUser(req, res, next) {
  try {
    return await renderCreateUserForm(req, res, {
      success: req.query.ok ? 'Usuario registrado. Ahora puedes iniciar sesión.' : null
    });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const department = userService.normalizeDepartment(req.body.department);
  const role = String(req.body.role || '').trim().toLowerCase();

  try {
    if (!username || !password || !department || !role) {
      return await renderCreateUserForm(req, res, {
        error: 'Completa todos los campos del formulario.',
        formData: { username, department, role }
      });
    }

    if (password.length < 6) {
      return await renderCreateUserForm(req, res, {
        error: 'La contraseña debe tener al menos 6 caracteres.',
        formData: { username, department, role }
      });
    }

    const allowedRoles = departmentRoles[department] || [];
    if (!allowedRoles.includes(role)) {
      return await renderCreateUserForm(req, res, {
        error: 'El rol seleccionado no corresponde al departamento.',
        formData: { username, department, role }
      });
    }

    if (await userService.usernameExists(username)) {
      return await renderCreateUserForm(req, res, {
        error: 'Ese nombre de usuario ya existe.',
        formData: { username, department, role }
      });
    }

    await userService.createUser({ username, password, department, role });
    return res.redirect('/login?created=1');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  renderCreateUser,
  createUser
};
