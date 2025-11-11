const db = require('../db');

async function casesByStatus(req, res, next) {
  try {
    const [rows] = await db.execute('SELECT status, COUNT(*) AS count FROM cases GROUP BY status');
    res.json(rows);
  } catch (err) { next(err); }
}

async function evidenceByTypeAndStatus(req, res, next) {
  try {
    const [rows] = await db.execute('SELECT evidence_type, current_status, COUNT(*) as count FROM evidence_items GROUP BY evidence_type, current_status');
    res.json(rows);
  } catch (err) { next(err); }
}

async function monthlyTransfers(req, res, next) {
  try {
    const [rows] = await db.execute("SELECT DATE_FORMAT(transfer_date, '%Y-%m') AS month, COUNT(*) AS transfers FROM evidence_transfers GROUP BY month ORDER BY month ASC");
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { casesByStatus, evidenceByTypeAndStatus, monthlyTransfers };

// Admin: Access logs listing
async function accessLogs(req, res, next) {
  try {
    // Detect whether users table has a single 'name' column
    const [cols] = await db.execute(
      `SELECT COUNT(*) AS has_name
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'name'`
    );
    const useSingleName = cols[0]?.has_name > 0;
    const nameExpr = useSingleName
      ? 'u.name'
      : "CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))";

    const [rows] = await db.execute(
      `SELECT l.log_id, l.evidence_id, ${nameExpr} AS user_name, l.action, l.timestamp
         FROM access_logs l
         LEFT JOIN users u ON l.user_id = u.user_id
        ORDER BY l.timestamp DESC
        LIMIT 500`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports.accessLogs = accessLogs;
