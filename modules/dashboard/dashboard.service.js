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
    SELECT * 
    FROM vw_dashboard_muestras_alerta
    ORDER BY muestra_vencida DESC, prox_muestra ASC, codigo
  `);

  const [bombasCriticas] = await pool.query(`
    SELECT  
      p.codigo AS pozo,
      ml.nombre AS metodo,
      bh.marca,
      bh.modelo,
      bh.serial,
      bh.fecha_inst,
      CASE
        WHEN bh.fecha_inst IS NULL THEN bh.tvu
        WHEN bh.fecha_inst > CURDATE() THEN 0
        ELSE DATEDIFF(CURDATE(), bh.fecha_inst)
      END AS tvu_dias,
      CASE
        WHEN bh.fecha_inst IS NULL THEN 'SIN_FECHA'
        WHEN DATEDIFF(CURDATE(), bh.fecha_inst) >= 365 THEN 'CRITICO'
        WHEN DATEDIFF(CURDATE(), bh.fecha_inst) >= 250 THEN 'PENDIENTE'
        ELSE 'NORMAL'
      END AS estado_tvu,
      CASE
        WHEN bh.fecha_inst IS NULL THEN NULL
        WHEN DATEDIFF(CURDATE(), bh.fecha_inst) >= 365 THEN 0
        ELSE 365 - DATEDIFF(CURDATE(), bh.fecha_inst)
      END AS dias_para_critico
    FROM bombas_historial bh
    INNER JOIN pozos p ON p.id = bh.id_pozo
    INNER JOIN estado_pozo ep ON ep.id = p.id_estado
    LEFT JOIN metodos_levantamiento ml ON ml.id = p.id_metodo
    WHERE bh.estatus = 'ACTIVA'
      AND LOWER(ep.nombre) = 'activo'
      AND (
        CASE
          WHEN bh.fecha_inst IS NULL THEN bh.tvu
          WHEN bh.fecha_inst > CURDATE() THEN 0
          ELSE DATEDIFF(CURDATE(), bh.fecha_inst)
        END
      ) >= 250
    ORDER BY tvu_dias DESC
  `);

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