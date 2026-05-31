const { pool } = require('../../config/db');

async function listServicios() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre AS servicio,
        tipo_servicio,
        subtipo,
        activo
      FROM servicios
      ORDER BY nombre ASC
    `
  );

  return rows;
}

module.exports = {
  listServicios
};
