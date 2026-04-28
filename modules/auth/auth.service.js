const { pool } = require('../../config/db');
const { verifyPassword } = require('../../services/auth/password.service');
const { normalizeDepartmentKey } = require('../../middleware/auth');

async function findUserByUsername(username) {
  const cleanUsername = String(username || '').trim();

  if (!cleanUsername) return null;

  const [rows] = await pool.query(
    `SELECT 
        u.id,
        u.username,
        u.password,
        u.rol,
        u.id_dept,
        u.id_personal,
        u.nombre_operador_manual,
        u.cedula_operador_manual,
        u.activo,

        d.nombre AS department,

        p.nombre_completo AS personal_nombre,
        p.cedula AS personal_cedula

     FROM usuarios u
     INNER JOIN departamentos d 
        ON d.id = u.id_dept

     LEFT JOIN personal p 
        ON p.id = u.id_personal

     WHERE u.username = ?
       AND u.activo = 1

     LIMIT 1`,
    [cleanUsername]
  );

  return rows[0] || null;
}

function isValidPassword(password, user) {
  if (!user || Number(user.activo) === 0) return false;
  return verifyPassword(password, user.password);
}

function buildSessionUser(user) {
  const role = String(user.rol || '').toLowerCase();
  const department = user.department || null;

  const operadorNombre =
    user.personal_nombre ||
    user.nombre_operador_manual ||
    user.username;

  const operadorCedula =
    user.personal_cedula ||
    user.cedula_operador_manual ||
    null;

  return {
    id: user.id,
    username: user.username,

    idDept: user.id_dept,
    department,
    role,

    idPersonal: user.id_personal || null,

    operadorNombre,
    operadorCedula,

    isAdmin: role === 'admin',
    isCoordinator: role === 'coordinador',
    isReadOnly: role === 'trainee_visual',

    canManageUsers: ['admin', 'coordinador'].includes(role),
    canManagePersonal: ['admin', 'coordinador'].includes(role),
    canEdit: role !== 'trainee_visual'
  };
}

async function getTraineeUser() {
  const [rows] = await pool.query(`
    SELECT id, username
    FROM usuarios
    WHERE username = 'trainee'
    LIMIT 1
  `);

  return rows[0] || null;
}

async function getCurrentTraineeAssignment() {
  const [rows] = await pool.query(`
    SELECT ta.*
    FROM trainee_asignaciones ta
    INNER JOIN usuarios u ON u.id = ta.id_usuario
    WHERE u.username = 'trainee'
      AND ta.activo = 1
    LIMIT 1
  `);

  return rows[0] || null;
}

async function updateCurrentTrainee({ nombre, cedula }) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[traineeUser]] = await conn.query(`
      SELECT id
      FROM usuarios
      WHERE username = 'trainee'
      LIMIT 1
    `);

    if (!traineeUser) {
      throw new Error('No existe el usuario trainee.');
    }

    await conn.query(`
      UPDATE trainee_asignaciones
      SET activo = 0,
          fecha_fin = CURDATE()
      WHERE id_usuario = ?
        AND activo = 1
    `, [traineeUser.id]);

    await conn.query(`
      INSERT INTO trainee_asignaciones (
        id_usuario,
        nombre,
        cedula,
        fecha_inicio,
        activo
      )
      VALUES (?, ?, ?, CURDATE(), 1)
    `, [traineeUser.id, nombre, cedula || null]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  findUserByUsername,
  isValidPassword,
  buildSessionUser
};