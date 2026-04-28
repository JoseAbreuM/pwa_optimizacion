const userService = require('./user.service');



async function renderUsersModule(req, res, next) {
  try {
    const [usuarios, personal, departments, traineeActual] = await Promise.all([
      userService.getUsers(),
      userService.getPersonal(),
      userService.loadDepartments(),
      userService.getCurrentTraineeAssignment()
    ]);

return res.render('modules/users/index', {
      title: 'Usuarios y personal',
      pageTitle: 'Usuarios y personal',
      layout: 'layouts/mainLayout',
      pageScript: '/js/modules/users.js',
      currentSection: 'usuarios',
      currentUser: req.session.user,

      usuarios,
      personal,
      departments,
      traineeActual,

      roles: userService.getRoleOptions(),
      error: null,
      success: null
    });
  } catch (error) {
    return next(error);
  }
}

async function renderCreateUserForm(req, res, options = {}) {
  const [departments, personal] = await Promise.all([
    userService.loadDepartments(),
    userService.getPersonal()
  ]);

  return res.render('users/crear', {
    title: 'Crear usuario',
    pageTitle: 'Crear usuario',
    layout: 'layouts/mainLayout',
    currentSection: 'usuarios',
    currentUser: req.session.user,

    error: options.error || null,
    success: options.success || null,

    departments,
    personal,
    roles: userService.getRoleOptions(),

    formData: options.formData || {
      username: '',
      id_dept: '',
      rol: 'ing_dpto',
      id_personal: ''
    }
  });
}

async function renderCreateUser(req, res, next) {
  try {
    return await renderCreateUserForm(req, res);
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const idDept = req.body.id_dept ? Number(req.body.id_dept) : null;
  const rol = String(req.body.rol || '').trim().toLowerCase();
  const idPersonal = req.body.id_personal ? Number(req.body.id_personal) : null;

  const formData = {
    username,
    id_dept: idDept || '',
    rol,
    id_personal: idPersonal || ''
  };

  try {
    if (!req.session.user?.canManageUsers) {
      return res.status(403).render('errors/noAutorizado', {
        title: 'Sin acceso',
        currentUser: req.session.user
      });
    }

    if (!username || !password || !idDept || !rol) {
      return await renderCreateUserForm(req, res, {
        error: 'Completa usuario, contraseña, departamento y rol.',
        formData
      });
    }

    if (password.length < 6) {
      return await renderCreateUserForm(req, res, {
        error: 'La contraseña debe tener al menos 6 caracteres.',
        formData
      });
    }

    const validRoles = userService.getRoleOptions().map((item) => item.value);

    if (!validRoles.includes(rol)) {
      return await renderCreateUserForm(req, res, {
        error: 'El rol seleccionado no es válido.',
        formData
      });
    }

    if (await userService.usernameExists(username)) {
      return await renderCreateUserForm(req, res, {
        error: 'Ese nombre de usuario ya existe.',
        formData
      });
    }

    await userService.createUser({
      username,
      password,
      id_dept: idDept,
      rol,
      id_personal: idPersonal
    });

    return res.redirect('/usuarios');
  } catch (error) {
    return next(error);
  }
}


async function renderCreatePersonal(req, res) {
  return res.status(501).send('Formulario de personal pendiente de implementar');
}

async function createPersonal(req, res) {
  return res.status(501).send('Creación de personal pendiente de implementar');
}

async function renderTrainee(req, res) {
  return res.status(501).send('Gestión de trainee pendiente de implementar');
}

async function updateTrainee(req, res) {
  return res.status(501).send('Actualización de trainee pendiente de implementar');
}

module.exports = {
  renderUsersModule,
  renderCreateUser,
  createUser,
  renderCreatePersonal,
  createPersonal,
  renderTrainee,
  updateTrainee
};