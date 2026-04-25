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


const [bombasCriticas] = await pool.query(`
  SELECT *
  FROM vw_dashboard_bombas_tvu_critico
  ORDER BY tvu DESC
  LIMIT 10
`);

console.log({
  muestrasAlerta: muestrasAlerta.length,
  bombasCriticas: bombasCriticas.length,
  categorias: categorias.length,
  servicios: servicios.length
});

  return {
  title: 'Dashboard',
  currentUser: currentUser || null,
  currentSection: 'dashboard',
  layout: 'layouts/mainLayout',
  pageScript: '/js/modules/dashboard.js',
  kpis,
  categorias,
  servicios,
  muestrasAlerta,
  bombasCriticas
};
}

module.exports = {
  getDashboardData
};