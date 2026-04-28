const authService = require('./auth.service');

function renderLogin(req, res) {
  if (req.session.user) return res.redirect('/dashboard');

  return res.render('auth/login', {
    title: 'Iniciar sesión',
    error: null,
    success: req.query.created ? 'Usuario creado correctamente. Ya puedes iniciar sesión.' : null,
    layout: 'layouts/auth-layout'
  });
}

async function login(req, res, next) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).render('auth/login', {
      title: 'Iniciar sesión',
      layout: 'layouts/auth-layout',
      success: null,
      error: 'Completa usuario y contraseña.'
    });
  }

  try {
    const user = await authService.findUserByUsername(username);

    if (!authService.isValidPassword(password, user)) {
      return res.status(401).render('auth/login', {
        title: 'Iniciar sesión',
        layout: 'layouts/auth-layout',
        success: null,
        error: 'Credenciales inválidas.'
      });
    }

    req.session.user = authService.buildSessionUser(user);
    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

function redirectRoot(req, res) {
  if (req.session.user) return res.redirect('/dashboard');
  return res.redirect('/login');
}


async function renderTrainee(req, res, next) {
  try {
    const traineeActual = await userService.getCurrentTraineeAssignment();

    res.render('users/trainee', {
      title: 'Trainee actual',
      currentUser: req.session.user,
      layout: 'layouts/mainLayout',
      traineeActual,
      error: null,
      success: null
    });
  } catch (error) {
    next(error);
  }
}

async function updateTrainee(req, res, next) {
  const nombre = String(req.body.nombre || '').trim();
  const cedula = String(req.body.cedula || '').trim();

  if (!nombre) {
    return res.status(400).render('users/trainee', {
      title: 'Trainee actual',
      currentUser: req.session.user,
      layout: 'layouts/mainLayout',
      traineeActual: null,
      success: null,
      error: 'Indica el nombre del trainee.'
    });
  }

  try {
    await userService.updateCurrentTrainee({ nombre, cedula });

    const traineeActual = await userService.getCurrentTraineeAssignment();

    res.render('users/trainee', {
      title: 'Trainee actual',
      currentUser: req.session.user,
      layout: 'layouts/mainLayout',
      traineeActual,
      error: null,
      success: 'Trainee actualizado correctamente.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderLogin,
  login,
  logout,
  redirectRoot
};
