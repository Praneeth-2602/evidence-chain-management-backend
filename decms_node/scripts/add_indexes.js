// Adds helpful composite and lookup indexes if they don't already exist
// Usage: node -r dotenv/config scripts/add_indexes.js

const mysql = require('mysql2/promise');

async function ensureIndex(conn, table, indexName, columns) {
  // columns: e.g., "(evidence_id, transfer_date)"
  const [rows] = await conn.execute(
    `SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if ((rows[0]?.cnt || 0) === 0) {
    const sql = `CREATE INDEX \`${indexName}\` ON \`${table}\` ${columns}`;
    console.log('Creating index:', sql);
    await conn.execute(sql);
  } else {
    console.log(`Index ${table}.${indexName} already exists`);
  }
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'decms',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });
  const conn = await pool.getConnection();
  try {
    console.log('Ensuring helpful indexes exist...');
    // evidence_transfers: accelerate timeline queries per evidence ordered by date
    await ensureIndex(conn, 'evidence_transfers', 'idx_transfers_evidence_date', '(evidence_id, transfer_date)');

    // access_logs: common filters by evidence or user, ordered by time
    await ensureIndex(conn, 'access_logs', 'idx_logs_evidence_time', '(evidence_id, timestamp)');
    await ensureIndex(conn, 'access_logs', 'idx_logs_user_time', '(user_id, timestamp)');

    // evidence_items: quick lookups by custodian and status
    await ensureIndex(conn, 'evidence_items', 'idx_evidence_custodian', '(current_custodian_id)');
    await ensureIndex(conn, 'evidence_items', 'idx_evidence_status', '(current_status)');

    console.log('Index ensure completed.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
