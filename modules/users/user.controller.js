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

  return res.render('modules/users/crear', {
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


async function renderCreatePersonalForm(req, res, options = {}) {
  const departments = await userService.loadDepartments();

  return res.render('modules/users/crear-personal', {
    title: 'Crear personal',
    pageTitle: 'Crear personal',
    layout: 'layouts/mainLayout',
    currentSection: 'usuarios',
    currentUser: req.session.user,

    departments,

    error: options.error || null,
    success: options.success || null,

    formData: options.formData || {
      nombre_completo: '',
      cedula_tipo: 'V',
      cedula_numero: '',
      id_dept: '',
      activo: 1
    }
  });
}

async function renderCreatePersonal(req, res, next) {
  try {
    return await renderCreatePersonalForm(req, res);
  } catch (error) {
    return next(error);
  }
}

async function createPersonal(req, res, next) {
  const nombreCompleto = String(req.body.nombre_completo || '').trim();
  const cedulaTipo = String(req.body.cedula_tipo || 'V').trim().toUpperCase();
  const cedulaNumero = String(req.body.cedula_numero || '').trim();
  const cedula = cedulaNumero ? `${cedulaTipo}-${cedulaNumero}` : '';

  const idDept = req.body.id_dept ? Number(req.body.id_dept) : null;
  const activo = req.body.activo === '0' ? 0 : 1;

  const formData = {
    nombre_completo: nombreCompleto,
    cedula_tipo: cedulaTipo,
    cedula_numero: cedulaNumero,
    id_dept: idDept || '',
    activo
  };

  try {
    if (!req.session.user?.canManagePersonal) {
      return res.status(403).render('errors/noAutorizado', {
        title: 'Sin acceso',
        currentUser: req.session.user
      });
    }

    if (!nombreCompleto || !idDept || !cedulaNumero) {
      return await renderCreatePersonalForm(req, res, {
        error: 'Completa nombre, cédula y departamento.',
        formData
      });
    }

    await userService.createPersonal({
      nombre_completo: nombreCompleto,
      cedula,
      id_dept: idDept,
      activo
    });

    return res.redirect('/usuarios');
  } catch (error) {
    return next(error);
  }
}
async function renderTrainee(req, res, next) {
  try {
    const traineeActual = await userService.getCurrentTraineeAssignment();

    return res.render('modules/users/trainee', {
      title: 'Trainee actual',
      pageTitle: 'Trainee actual',
      layout: 'layouts/mainLayout',
      currentSection: 'usuarios',
      currentUser: req.session.user,
      traineeActual,
      error: null,
      success: null
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTrainee(req, res, next) {
  const nombre = String(req.body.nombre || '').trim();
  const cedula = String(req.body.cedula || '').trim();

  try {
    if (!nombre) {
      return res.redirect('/usuarios');
    }

    await userService.updateTraineeAssignment({
      nombre,
      cedula
    });

    return res.redirect('/usuarios');
  } catch (error) {
    return next(error);
  }
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