const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pwa_opti',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  connectTimeout: 10000,
  decimalNumbers: true,
  charset: 'utf8mb4'
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function countTableSafe(tableName) {
  try {
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);

    return {
      table: tableName,
      ok: true,
      total: rows[0]?.total ?? 0
    };
  } catch (error) {
    return {
      table: tableName,
      ok: false,
      message: error.message,
      code: error.code
    };
  }
}

async function testConnection() {
  const [dbRows] = await pool.query('SELECT DATABASE() AS db');

  const dbName = dbRows[0]?.db || process.env.DB_NAME || 'pwa_opti';

  console.log('=================================');
  console.log('Conexión MySQL OK');
  console.log('DB_HOST:', process.env.DB_HOST || '127.0.0.1');
  console.log('DB_PORT:', process.env.DB_PORT || 3306);
  console.log('DB_USER:', process.env.DB_USER || 'root');
  console.log('DB_NAME conectado:', dbName);

  const tablas = [
    'pozos',
    'estado_pozo',
    'cabezales',
    'vdfs',
    'metodos_levantamiento',
    'vw_pozos_listado',
    'vw_dashboard_kpis',
    'vw_mapa_pozos_sync'
  ];

  for (const tabla of tablas) {
    const result = await countTableSafe(tabla);

    if (result.ok) {
      console.log(`${tabla}:`, result.total);
    } else {
      console.log(`${tabla}: ERROR -> ${result.code || ''} ${result.message}`);
    }
  }

  console.log('=================================');

  return dbName;
}

pool.on('connection', (connection) => {
  connection.on('error', (error) => {
    console.error('Error en conexión MySQL:', error.code, error.message);
  });
});

module.exports = {
  pool,
  query,
  testConnection
};