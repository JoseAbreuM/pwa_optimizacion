const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pwa_opti',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('Configuración DB cargada:', {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'pwa_opti'
});

async function testConnection() {
  const connection = await pool.getConnection();

  try {
    const [dbRows] = await connection.query('SELECT DATABASE() AS db');

    console.log('=================================');
    console.log('Conexión MySQL OK');
    console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
    console.log('DB_PORT:', process.env.DB_PORT || 3306);
    console.log('DB_USER:', process.env.DB_USER || 'root');
    console.log('DB_NAME conectado:', dbRows[0]?.db);

    const tablas = [
      'pozos',
      'estados_pozo',
      'cabezales',
      'vdfs',
      'metodos_levantamiento',
      'vw_pozos_listado',
      'vw_dashboard_kpis',
      'vw_mapa_pozos_sync'
    ];

    for (const tabla of tablas) {
      try {
        const [rows] = await connection.query(
          `SELECT COUNT(*) AS total FROM \`${tabla}\``
        );

        console.log(`${tabla}:`, rows[0]?.total);
      } catch (error) {
        console.log(`${tabla}: ERROR -> ${error.message}`);
      }
    }

    console.log('=================================');

    return dbRows[0]?.db || process.env.DB_NAME || 'pwa_opti';
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection
};