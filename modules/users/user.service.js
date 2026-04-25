const { pool } = require('../../config/db');
const { departmentRoles } = require('../../middleware/auth');
const { hashPassword } = require('../../services/auth/password.service');

const departmentLabels = {
  optimizacion: 'Optimización',
  operaciones: 'Operaciones',
  mantenimiento: 'Mantenimiento',
  laboratorio: 'Laboratorio',
  seguridad: 'Seguridad',
  admin: 'Admin'
};

function getRoleOptions() {
  return Object.values(departmentRoles).flat();
}

function normalizeDepartment(value) {
  return String(value || '').trim().toLowerCase();
}

function getDepartmentLabel(value) {
  const key = normalizeDepartment(value);
  return departmentLabels[key] || key;
}

async function loadDepartments() {
  const [rows] = await pool.query('SELECT id, nombre FROM departamentos ORDER BY nombre');

  if (rows.length) return rows;

  return Object.keys(departmentRoles).map((key, index) => ({
    id: index + 1,
    nombre: getDepartmentLabel(key)
  }));
}

async function ensureDepartment(department) {
  const departmentName = getDepartmentLabel(department);
  const [rows] = await pool.query(
    'SELECT id FROM departamentos WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [departmentName]
  );

  if (rows.length) return rows[0].id;

  const [result] = await pool.query('INSERT INTO departamentos (nombre) VALUES (?)', [departmentName]);
  return result.insertId;
}

async function usernameExists(username) {
  const [rows] = await pool.query('SELECT id FROM usuarios WHERE username = ? LIMIT 1', [username]);
  return Boolean(rows.length);
}

async function createUser({ username, password, department, role }) {
  const departmentId = await ensureDepartment(department);
  const passwordHash = hashPassword(password);

  await pool.query(
    'INSERT INTO usuarios (username, password, id_dept, rol) VALUES (?, ?, ?, ?)',
    [username, passwordHash, departmentId, role]
  );
}

module.exports = {
  getRoleOptions,
  normalizeDepartment,
  loadDepartments,
  usernameExists,
  createUser
};
