const { pool } = require('../../config/db');
const { hashPassword } = require('../../services/auth/password.service');

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'ing_dpto', label: 'Ing. Dpto' },
  { value: 'ing_trainee', label: 'Ing. Trainee' },
  { value: 'trainee_visual', label: 'Trainee visual' }
];

function getRoleOptions() {
  return roleOptions;
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function loadDepartments() {
  const [rows] = await pool.query(`
    SELECT id, nombre
    FROM departamentos
    ORDER BY nombre ASC
  `);

  return rows;
}

async function usernameExists(username, excludeUserId = null) {
  const params = [normalizeText(username)];
  let sql = `
    SELECT id
    FROM usuarios
    WHERE username = ?
  `;

  if (excludeUserId) {
    sql += ` AND id <> ?`;
    params.push(Number(excludeUserId));
  }

  sql += ` LIMIT 1`;

  const [rows] = await pool.query(sql, params);
  return Boolean(rows.length);
}

async function createUser({
  username,
  password,
  id_dept,
  rol,
  id_personal = null
}) {
  const passwordHash = hashPassword(password);

  const [result] = await pool.query(
    `INSERT INTO usuarios (
      username,
      password,
      id_dept,
      rol,
      id_personal,
      activo
    )
    VALUES (?, ?, ?, ?, ?, 1)`,
    [
      normalizeText(username),
      passwordHash,
      Number(id_dept),
      normalizeText(rol),
      id_personal ? Number(id_personal) : null
    ]
  );

  return result.insertId;
}

async function getUsers() {
  const [rows] = await pool.query(`
    SELECT
      u.id,
      u.username,
      u.rol,
      u.activo,
      u.id_dept,
      u.id_personal,
      d.nombre AS departamento,
      p.nombre_completo AS personal_nombre,
      p.cedula AS personal_cedula
    FROM usuarios u
    INNER JOIN departamentos d ON d.id = u.id_dept
    LEFT JOIN personal p ON p.id = u.id_personal
    ORDER BY u.username ASC
  `);

  return rows;
}

async function getUserById(id) {
  const [rows] = await pool.query(`
    SELECT
      id,
      username,
      rol,
      activo,
      id_dept,
      id_personal
    FROM usuarios
    WHERE id = ?
    LIMIT 1
  `, [Number(id)]);

  return rows[0] || null;
}

async function updateUser(id, {
  username,
  id_dept,
  rol,
  id_personal = null,
  activo = 1,
  password = null
}) {
  const params = [
    normalizeText(username),
    Number(id_dept),
    normalizeText(rol),
    id_personal ? Number(id_personal) : null,
    Number(activo),
    Number(id)
  ];

  let sql = `
    UPDATE usuarios
    SET
      username = ?,
      id_dept = ?,
      rol = ?,
      id_personal = ?,
      activo = ?
  `;

  if (password) {
    sql += `, password = ?`;
    params.splice(params.length - 1, 0, hashPassword(password));
  }

  sql += ` WHERE id = ?`;

  await pool.query(sql, params);
}

async function getPersonal() {
  const [rows] = await pool.query(`
    SELECT
      p.id,
      p.nombre_completo,
      p.cedula,
      p.activo,
      p.id_dept,
      d.nombre AS departamento
    FROM personal p
    LEFT JOIN departamentos d ON d.id = p.id_dept
    ORDER BY p.nombre_completo ASC
  `);

  return rows;
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


async function createPersonal({
  nombre_completo,
  cedula,
  id_dept,
  activo = 1
}) {
  const [result] = await pool.query(
    `INSERT INTO personal (
      nombre_completo,
      cedula,
      id_dept,
      activo
    )
    VALUES (?, ?, ?, ?)`,
    [
      normalizeText(nombre_completo),
      normalizeText(cedula),
      Number(id_dept),
      Number(activo)
    ]
  );

  return result.insertId;
}

async function getTraineeUserId() {
  const [rows] = await pool.query(`
    SELECT id
    FROM usuarios
    WHERE username = 'trainee'
    LIMIT 1
  `);

  return rows[0]?.id || null;
}

async function updateTraineeAssignment({ nombre, cedula }) {
  const traineeUserId = await getTraineeUserId();

  if (!traineeUserId) {
    throw new Error('No existe el usuario trainee.');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`
      UPDATE trainee_asignaciones
      SET activo = 0,
          fecha_fin = NOW()
      WHERE id_usuario = ?
        AND activo = 1
    `, [traineeUserId]);

    await conn.query(`
      INSERT INTO trainee_asignaciones (
        id_usuario,
        nombre,
        cedula,
        fecha_inicio,
        activo
      )
      VALUES (?, ?, ?, NOW(), 1)
    `, [
      traineeUserId,
      normalizeText(nombre),
      normalizeText(cedula) || null
    ]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  getRoleOptions,
  normalizeText,
  loadDepartments,
  usernameExists,
  createUser,
  getUsers,
  getUserById,
  updateUser,
  getPersonal,
  getCurrentTraineeAssignment,
  updateTraineeAssignment,
  createPersonal
};