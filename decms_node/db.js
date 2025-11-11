// MySQL connection pool with basic health checks & lazy init
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

function createPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'decms',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONN_LIMIT || '10', 10),
    queueLimit: 0,
    namedPlaceholders: true
  });
  return pool;
}

async function ping() {
  const p = createPool();
  try {
    const [rows] = await p.query('SELECT 1 as ok');
    return rows[0];
  } catch (err) {
    throw new Error('DB ping failed: ' + err.message);
  }
}

module.exports = Object.assign(createPool(), { ping });
