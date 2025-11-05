const db = require('../db');
const path = require('path');

async function createReport(req, res, next) {
  const { evidence_id, findings } = req.body;
  const file = req.file;
  if (!evidence_id || !findings) return res.status(400).json({ msg: 'Missing fields' });
  try {
    const file_path = file ? path.relative(process.cwd(), file.path) : null;
    const [result] = await db.execute('INSERT INTO analysis_reports (evidence_id, analyst_id, findings, report_file, created_at) VALUES (:evidence_id, :analyst_id, :findings, :report_file, NOW())', { evidence_id, analyst_id: req.user.user_id, findings, report_file: file_path });
    // Optionally call stored procedure to generate a summary (example)
    // await db.execute('CALL sp_generate_analysis_summary(?)', [evidence_id]);
    res.status(201).json({ report_id: result.insertId });
  } catch (err) { next(err); }
}

async function getReportsForEvidence(req, res, next) {
  const evidenceId = req.params.evidenceId;
  try {
    const [rows] = await db.execute('SELECT * FROM analysis_reports WHERE evidence_id = :evidenceId ORDER BY created_at DESC', { evidenceId });
    res.json(rows);
  } catch (err) { next(err); }
}

// Public: recent reports summary (tolerant to users.name vs first/last)
async function getReportsPublic(req, res, next) {
  try {
    // Detect if users.name exists
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
      `SELECT r.report_id, r.evidence_id, r.findings, r.report_file, r.created_at,
              ${nameExpr} AS analyst_name
         FROM analysis_reports r
         LEFT JOIN users u ON r.analyst_id = u.user_id
        ORDER BY r.created_at DESC
        LIMIT 200`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { createReport, getReportsForEvidence, getReportsPublic };

// Public create report: accepts evidence_id, findings, optional analyst_email or analyst_name
async function createReportPublic(req, res, next) {
  const { evidence_id, findings, analyst_email, analyst_name } = req.body;
  const file = req.file;
  if (!evidence_id || !findings) return res.status(400).json({ msg: 'Missing fields' });

  const conn = await db.getConnection();
  try {
    let analyst_id = null;

    // 1) Resolve by email first
    if (analyst_email) {
      const [byEmail] = await conn.execute('SELECT user_id FROM users WHERE email = ? LIMIT 1', [analyst_email]);
      if (byEmail.length) analyst_id = byEmail[0].user_id;
    }

    // 2) Resolve by name if provided and not found by email
    if (!analyst_id && analyst_name) {
      // Check if users.name exists
      const [cols] = await conn.execute(
        `SELECT COUNT(*) AS has_name
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'users'
            AND COLUMN_NAME = 'name'`
      );
      if (cols[0]?.has_name > 0) {
        const [byName] = await conn.execute('SELECT user_id FROM users WHERE name = ? LIMIT 1', [analyst_name]);
        if (byName.length) analyst_id = byName[0].user_id;
      } else {
        // Fallback to first/last if available
        const [hasFirst] = await conn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='first_name'`
        );
        const [hasLast] = await conn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='last_name'`
        );
        if (hasFirst[0].c > 0 && hasLast[0].c > 0) {
          const parts = analyst_name.split(' ');
          const first = parts[0] || '';
          const last = parts.slice(1).join(' ') || '';
          const [byFL] = await conn.execute('SELECT user_id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1', [first, last]);
          if (byFL.length) analyst_id = byFL[0].user_id;
        }
      }
    }

    // 3) Fallback to evidence.current_custodian_id or collected_by
    if (!analyst_id) {
      const [ev] = await conn.execute('SELECT current_custodian_id, collected_by FROM evidence_items WHERE evidence_id = ? LIMIT 1', [evidence_id]);
      if (ev.length) {
        analyst_id = ev[0].current_custodian_id || ev[0].collected_by || null;
      }
    }

    // If still not resolved, try a sane default: any Lab Staff or Admin
    if (!analyst_id) {
      // Prefer Lab Staff
      const [roleCols] = await conn.execute(
        `SELECT GROUP_CONCAT(COLUMN_NAME) AS cols
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
      );
      const colsList = (roleCols[0]?.cols || '').split(',');
      const hasRole = colsList.includes('role');
      if (hasRole) {
        const [lab] = await conn.execute("SELECT user_id FROM users WHERE role IN ('Lab Staff','Admin','Investigator') ORDER BY FIELD(role,'Lab Staff','Admin','Investigator') LIMIT 1");
        if (lab.length) analyst_id = lab[0].user_id;
      } else {
        // As a last resort, pick any user
        const [any] = await conn.execute('SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1');
        if (any.length) analyst_id = any[0].user_id;
      }
    }

    const file_path = file ? path.relative(process.cwd(), file.path) : null;
    const [result] = await conn.execute(
      'INSERT INTO analysis_reports (evidence_id, analyst_id, findings, report_file, created_at) VALUES (:evidence_id, :analyst_id, :findings, :report_file, NOW())',
      { evidence_id, analyst_id, findings, report_file: file_path }
    );
    res.status(201).json({ report_id: result.insertId });
  } catch (err) { next(err); }
  finally { conn.release(); }
}

module.exports = { createReport, getReportsForEvidence, getReportsPublic, createReportPublic };
