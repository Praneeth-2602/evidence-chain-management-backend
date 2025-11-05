const db = require('../db');

async function getCases(req, res, next) {
  try {
    const [rows] = await db.query('SELECT case_id, case_title, description, assigned_to, status, created_at FROM cases ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Public listing variant
async function getCasesPublic(req, res, next) {
  try {
    const [rows] = await db.query('SELECT case_id, case_title, description, assigned_to, status, created_at FROM cases ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
}

async function createCase(req, res, next) {
  const { case_title, description, assigned_to } = req.body;
  if (!case_title) return res.status(400).json({ msg: 'case_title required' });
  try {
    const sql = `INSERT INTO cases (case_title, description, assigned_to, status, created_at) VALUES (:case_title, :description, :assigned_to, 'Open', NOW())`;
    const [result] = await db.execute(sql, { case_title, description, assigned_to });
    res.status(201).json({ case_id: result.insertId });
  } catch (err) { next(err); }
}

async function getCase(req, res, next) {
  const id = req.params.id;
  try {
    const [caseRows] = await db.execute('SELECT * FROM cases WHERE case_id = :id', { id });
    if (!caseRows[0]) return res.status(404).json({ msg: 'Case not found' });
    const [evidence] = await db.execute('SELECT * FROM evidence_items WHERE case_id = :id', { id });
    res.json({ case: caseRows[0], evidence });
  } catch (err) { next(err); }
}

async function updateCase(req, res, next) {
  const id = req.params.id;
  const { status } = req.body; // expect 'Open','in-progress','Closed'
  try {
    await db.execute('UPDATE cases SET status = :status WHERE case_id = :id', { status, id });
    res.json({ msg: 'Updated' });
  } catch (err) { next(err); }
}

module.exports = { getCases, createCase, getCase, updateCase, getCasesPublic, createCasePublic };

// Public create case: accepts case_title, description, assigned_to_email or assigned_to_name
async function createCasePublic(req, res, next) {
  const { case_title, description, assigned_to_email, assigned_to_name } = req.body;
  if (!case_title) return res.status(400).json({ msg: 'case_title required' });
  const conn = await db.getConnection();
  try {
    // resolve assigned_to id
    let assigned_to = null;
    if (assigned_to_email) {
      const [r] = await conn.execute('SELECT user_id FROM users WHERE email = ? LIMIT 1', [assigned_to_email]);
      if (r.length) assigned_to = r[0].user_id;
    }
    if (!assigned_to && assigned_to_name) {
      // First try schema with a single 'name' column
      try {
        const [rn] = await conn.execute('SELECT user_id FROM users WHERE name = ? LIMIT 1', [assigned_to_name]);
        if (rn.length) assigned_to = rn[0].user_id;
      } catch (e) { /* ignore */ }

      // If still not found, and first_name/last_name exist, try split lookup
      if (!assigned_to) {
        try {
          const [cols] = await conn.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
          );
        	const cset = new Set(cols.map((c) => c.COLUMN_NAME));
          if (cset.has('first_name') && cset.has('last_name')) {
            const parts = assigned_to_name.trim().split(/\s+/);
            if (parts.length >= 2) {
              const first = parts[0];
              const last = parts.slice(1).join(' ');
              const [r2] = await conn.execute('SELECT user_id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1', [first, last]);
              if (r2.length) assigned_to = r2[0].user_id;
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    // detect cases table columns to handle schemas with created_by and/or case_number
    const [schemaRow] = await conn.query('SELECT DATABASE() AS db');
    const dbName = Array.isArray(schemaRow) ? schemaRow[0].db : schemaRow.db;
    let cols = new Map();
    try {
      const [colRows] = await conn.execute(
        `SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cases'`,
        [dbName]
      );
      colRows.forEach((r) => cols.set(r.COLUMN_NAME, r.IS_NULLABLE));
    } catch (e) {
      // if metadata call fails, proceed with default insert
    }

    const hasAssignedTo = cols.has('assigned_to');
    const hasCreatedBy = cols.has('created_by');
    const hasCaseNumber = cols.has('case_number');

    // Build dynamic insert
    const columns = ['case_title', 'description'];
    const values = [':case_title', ':description'];
    const params = { case_title, description };

    if (hasAssignedTo) {
      columns.push('assigned_to');
      values.push(':assigned_to');
      params.assigned_to = assigned_to ?? null;
    }
    if (hasCreatedBy) {
      columns.push('created_by');
      values.push(':created_by');
      // if created_by exists, use assigned_to as creator when available
      params.created_by = assigned_to ?? null;
    }
    if (hasCaseNumber) {
      columns.push('case_number');
      values.push(':case_number');
      params.case_number = 'PENDING';
    }

    columns.push('status', 'created_at');
    values.push("'Open'", 'NOW()');

    const sql = `INSERT INTO cases (${columns.join(', ')}) VALUES (${values.join(', ')})`;
    const [result] = await conn.execute(sql, params);

    // If case_number exists, update it to a formatted value now that we have insertId
    if (hasCaseNumber) {
      const generated = `CS-${String(result.insertId).padStart(4, '0')}`;
      await conn.execute('UPDATE cases SET case_number = ? WHERE case_id = ?', [generated, result.insertId]);
      return res.status(201).json({ case_id: result.insertId, case_number: generated });
    }

    res.status(201).json({ case_id: result.insertId });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
}
