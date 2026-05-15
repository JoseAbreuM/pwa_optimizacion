const { pool } = require('../../config/db');

async function getPotencialPorArea() {
  const [rows] = await pool.query(`
    SELECT
      area,
      potencial_total
    FROM vw_dashboard_potencial_area
    ORDER BY
      CASE area
        WHEN 'Bare Tradicional' THEN 1
        WHEN 'Bare Este' THEN 2
        WHEN 'Bare 6' THEN 3
        WHEN 'Total Campo' THEN 99
        ELSE 50
      END
  `);

  const colorsByArea = {
    'Bare Tradicional': '#16A34A',
    'Bare Este': '#7C3AED',
    'Bare 6': '#2563EB',
    Trilla: '#7C3AED',
    'Asfaltada y Tigra': '#DC2626',
    'Total Campo': '#033F73'
  };

  return {
    labels: rows.map((row) => row.area),
    values: rows.map((row) => Number(row.potencial_total || 0)),
    colors: rows.map((row) => colorsByArea[row.area] || '#64748B')
  };
}

async function getDashboardData(currentUser) {
  const [[kpis]] = await pool.query(`
    SELECT *
    FROM vw_dashboard_kpis
  `);

  const [categorias] = await pool.query(`
    SELECT *
    FROM vw_dashboard_categoria
    ORDER BY categoria
  `);

  const [servicios] = await pool.query(`
    SELECT *
    FROM vw_dashboard_servicios_catalogo
    ORDER BY servicio
  `);

  const [muestrasAlerta] = await pool.query(`
    SELECT *
    FROM vw_dashboard_muestras_alerta
    ORDER BY
      muestra_vencida DESC,
      prox_muestra ASC,
      codigo
  `);

  const [bombasCriticas] = await pool.query(`
    SELECT
      p.codigo AS pozo,
      ml.nombre AS metodo,
      b.marca,
      b.modelo,
      b.serial,
      b.fecha_inst,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN b.fecha_inst > CURDATE() THEN 0
        WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
        ELSE DATEDIFF(CURDATE(), b.fecha_inst)
      END AS tvu_dias,

      CASE
        WHEN b.fecha_inst IS NULL THEN 'SIN_FECHA'
        WHEN (
          CASE
            WHEN b.fecha_inst > CURDATE() THEN 0
            WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
            ELSE DATEDIFF(CURDATE(), b.fecha_inst)
          END
        ) >= 365 THEN 'CRITICO'
        WHEN (
          CASE
            WHEN b.fecha_inst > CURDATE() THEN 0
            WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
            ELSE DATEDIFF(CURDATE(), b.fecha_inst)
          END
        ) >= 250 THEN 'PENDIENTE'
        ELSE 'NORMAL'
      END AS estado_tvu,

      CASE
        WHEN b.fecha_inst IS NULL THEN NULL
        WHEN (
          CASE
            WHEN b.fecha_inst > CURDATE() THEN 0
            WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
            ELSE DATEDIFF(CURDATE(), b.fecha_inst)
          END
        ) >= 365 THEN 0
        ELSE 365 - (
          CASE
            WHEN b.fecha_inst > CURDATE() THEN 0
            WHEN b.fecha_falla IS NOT NULL THEN DATEDIFF(b.fecha_falla, b.fecha_inst)
            ELSE DATEDIFF(CURDATE(), b.fecha_inst)
          END
        )
      END AS dias_para_critico

    FROM (
      SELECT
        bh.*,
        ROW_NUMBER() OVER (
          PARTITION BY bh.id_pozo
          ORDER BY
            CASE WHEN bh.fecha_falla IS NULL THEN 0 ELSE 1 END ASC,
            bh.fecha_inst DESC,
            bh.id DESC
        ) AS rn
      FROM bombas_historial bh
      WHERE bh.fecha_inst IS NOT NULL
    ) b

    INNER JOIN pozos p
      ON p.id = b.id_pozo

    INNER JOIN estado_pozo ep
      ON ep.id = p.id_estado

    LEFT JOIN metodos_levantamiento ml
      ON ml.id = p.id_metodo

    WHERE b.rn = 1
      AND b.fecha_falla IS NULL
      AND LOWER(TRIM(ep.nombre)) = 'activo'
      AND (
        CASE
          WHEN b.fecha_inst IS NULL THEN NULL
          WHEN b.fecha_inst > CURDATE() THEN 0
          ELSE DATEDIFF(CURDATE(), b.fecha_inst)
        END
      ) >= 250

    ORDER BY tvu_dias DESC
  `);

  const potencialPorArea = await getPotencialPorArea();

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
    bombasCriticas,
    potencialPorArea
  };
}

module.exports = {
  getDashboardData,
  getPotencialPorArea
};