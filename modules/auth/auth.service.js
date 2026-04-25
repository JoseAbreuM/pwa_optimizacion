const { pool } = require('../../config/db');
const { verifyPassword } = require('../../services/auth/password.service');

async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password, u.rol, d.nombre AS department
     FROM usuarios u
     INNER JOIN departamentos d ON d.id = u.id_dept
     WHERE u.username = ?
     LIMIT 1`,
    [String(username || '').trim()]
  );

  return rows[0] || null;
}

function isValidPassword(password, user) {
  if (!user) return false;
  return verifyPassword(password, user.password);
}

function buildSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    department: user.department,
    role: user.rol
  };
}

module.exports = {
  findUserByUsername,
  isValidPassword,
  buildSessionUser
};
