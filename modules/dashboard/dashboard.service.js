const { pool } = require('../../config/db');

async function getDashboardData(currentUser) {
  const [[kpis]] = await pool.query(`
    SELECT * FROM vw_dashboard_kpis
  `);

  const [categorias] = await pool.query(`
    SELECT * FROM vw_dashboard_categoria
    ORDER BY categoria
  `);

  const [servicios] = await pool.query(`
    SELECT * FROM vw_dashboard_servicios_catalogo
    ORDER BY servicio
  `);

const [muestrasAlerta] = await pool.query(`
  SELECT * FROM vw_dashboard_muestras_alerta
  ORDER BY muestra_vencida DESC, prox_muestra ASC, codigo
`);

  return {
    title: 'Dashboard',
    currentUser: currentUser || null,
    currentSection: 'dashboard',
    layout: 'layouts/mainLayout',
    kpis,
    categorias,
    servicios,
    muestrasAlerta
  };
}

module.exports = {
  getDashboardData
};