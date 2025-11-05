const db = require('../db');

// Ensure evidence_transfers has workflow columns
async function ensureTransfersSchema(conn) {
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='evidence_transfers'`
  );
  const names = new Set(cols.map(c => c.COLUMN_NAME));
  const alters = [];
  if (!names.has('status')) alters.push("ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'Requested'");
  if (!names.has('approved_by')) alters.push('ADD COLUMN approved_by INT NULL');
  if (!names.has('decision_remarks')) alters.push('ADD COLUMN decision_remarks TEXT NULL');
  if (!names.has('decision_date')) alters.push('ADD COLUMN decision_date DATETIME NULL');
  if (alters.length) {
    await conn.execute(`ALTER TABLE evidence_transfers ${alters.join(', ')}`);
  }
}

// Create transfer within a DB transaction to ensure atomicity
async function createTransfer(req, res, next) {
  const { evidence_id, from_user, to_user, remarks } = req.body;
  if (!evidence_id || !from_user || !to_user) return res.status(400).json({ msg: 'Missing fields' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureTransfersSchema(conn);
    // Protected path: treat as immediate approval
    const [ins] = await conn.execute(
      "INSERT INTO evidence_transfers (evidence_id, from_user, to_user, remarks, transfer_date, status, approved_by, decision_date) VALUES (?, ?, ?, ?, NOW(), 'Approved', ?, NOW())",
      [evidence_id, from_user, to_user, remarks || null, req.user.user_id]
    );
    await conn.execute('UPDATE evidence_items SET current_custodian_id = ?, current_status = ? WHERE evidence_id = ?', [to_user, 'Checked In', evidence_id]);
    await conn.execute('INSERT INTO access_logs (user_id, evidence_id, action, timestamp) VALUES (?, ?, ?, NOW())', [req.user.user_id, evidence_id, `TRANSFER_APPROVED:${from_user}->${to_user}`]);
    await conn.commit();
    res.status(201).json({ transfer_id: ins.insertId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function getTransfersForEvidence(req, res, next) {
  const evidenceId = req.params.evidenceId;
  try {
    const [rows] = await db.execute('SELECT * FROM evidence_transfers WHERE evidence_id = ? ORDER BY transfer_date ASC', [evidenceId]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getAllTransfers(req, res, next) {
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
    const fromExpr = useSingleName ? 'fu.name' : "CONCAT(COALESCE(fu.first_name,''), ' ', COALESCE(fu.last_name,''))";
    const toExpr = useSingleName ? 'tu.name' : "CONCAT(COALESCE(tu.first_name,''), ' ', COALESCE(tu.last_name,''))";

    const [rows] = await db.execute(
      `SELECT t.transfer_id, t.evidence_id, t.from_user, t.to_user, t.remarks, t.transfer_date, t.status,
              ${fromExpr} AS from_user_name,
              ${toExpr} AS to_user_name
         FROM evidence_transfers t
         LEFT JOIN users fu ON t.from_user = fu.user_id
         LEFT JOIN users tu ON t.to_user = tu.user_id
        ORDER BY t.transfer_date DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { createTransfer, getTransfersForEvidence, getAllTransfers };

// Public transfer creation: resolves from/to users by email or badge_number or name
async function createTransferPublic(req, res, next) {
  const { evidence_id, from_email, to_email, from_badge, to_badge, from_name, to_name, remarks } = req.body;
  if (!evidence_id || !(from_email || from_badge || from_name) || !(to_email || to_badge || to_name)) {
    return res.status(400).json({ msg: 'Missing fields (evidence_id and from/to identifiers required)' });
  }

  const conn = await db.getConnection();
  try {
    await ensureTransfersSchema(conn);
    // resolve user id helper
    async function resolveUser({ email, badge, name }) {
      if (email) {
        const [r] = await conn.execute('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);
        if (r.length) return r[0].user_id;
      }
      if (badge) {
        const [r] = await conn.execute('SELECT user_id FROM users WHERE badge_number = ? LIMIT 1', [badge]);
        if (r.length) return r[0].user_id;
      }
      if (name) {
        // Try single 'name' column first
        try {
          const [rn] = await conn.execute('SELECT user_id FROM users WHERE name = ? LIMIT 1', [name]);
          if (rn.length) return rn[0].user_id;
        } catch (e) { /* ignore */ }

        // If first/last exist, try split
        try {
          const [cols] = await conn.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
          );
          const cset = new Set(cols.map((c) => c.COLUMN_NAME));
          if (cset.has('first_name') && cset.has('last_name')) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
              const first = parts[0];
              const last = parts.slice(1).join(' ');
              const [r] = await conn.execute('SELECT user_id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1', [first, last]);
              if (r.length) return r[0].user_id;
            }
            // fallback to either matches if still not found
            const [r2] = await conn.execute('SELECT user_id FROM users WHERE first_name = ? OR last_name = ? LIMIT 1', [name, name]);
            if (r2.length) return r2[0].user_id;
          }
        } catch (e) { /* ignore */ }
      }
      return null;
    }

    const fromId = await resolveUser({ email: from_email, badge: from_badge, name: from_name });
    const toId = await resolveUser({ email: to_email, badge: to_badge, name: to_name });

    if (!fromId || !toId) return res.status(400).json({ msg: 'Could not resolve from/to user ids' });

    await conn.beginTransaction();
    // Public path: create as Requested; no custody change yet
    const [ins] = await conn.execute(
      "INSERT INTO evidence_transfers (evidence_id, from_user, to_user, remarks, transfer_date, status) VALUES (?, ?, ?, ?, NOW(), 'Requested')",
      [evidence_id, fromId, toId, remarks || null]
    );
    await conn.execute('INSERT INTO access_logs (user_id, evidence_id, action, timestamp) VALUES (?, ?, ?, NOW())', [fromId, evidence_id, `TRANSFER_REQUEST:${fromId}->${toId}`]);
    await conn.commit();
    res.status(201).json({ transfer_id: ins.insertId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// Approve transfer (protected)
async function approveTransfer(req, res, next) {
  const transferId = req.params.id;
  const { remarks } = req.body || {};
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureTransfersSchema(conn);
    const [rows] = await conn.execute('SELECT * FROM evidence_transfers WHERE transfer_id = ? FOR UPDATE', [transferId]);
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ msg: 'Transfer not found' }); }
    const t = rows[0];
    if (t.status && t.status !== 'Requested') { await conn.rollback(); return res.status(400).json({ msg: `Cannot approve transfer with status ${t.status}` }); }
    await conn.execute('UPDATE evidence_items SET current_custodian_id = ?, current_status = ? WHERE evidence_id = ?', [t.to_user, 'Checked In', t.evidence_id]);
    await conn.execute(
      "UPDATE evidence_transfers SET status='Approved', approved_by = ?, decision_remarks = COALESCE(?, decision_remarks), decision_date = NOW() WHERE transfer_id = ?",
      [req.user.user_id, remarks || null, transferId]
    );
    await conn.execute('INSERT INTO access_logs (user_id, evidence_id, action, timestamp) VALUES (?, ?, ?, NOW())', [req.user.user_id, t.evidence_id, `TRANSFER_APPROVED:${t.from_user}->${t.to_user}`]);
    await conn.commit();
    res.json({ msg: 'Approved' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// Reject transfer (protected)
async function rejectTransfer(req, res, next) {
  const transferId = req.params.id;
  const { remarks } = req.body || {};
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureTransfersSchema(conn);
    const [rows] = await conn.execute('SELECT * FROM evidence_transfers WHERE transfer_id = ? FOR UPDATE', [transferId]);
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ msg: 'Transfer not found' }); }
    const t = rows[0];
    if (t.status && t.status !== 'Requested') { await conn.rollback(); return res.status(400).json({ msg: `Cannot reject transfer with status ${t.status}` }); }
    await conn.execute(
      "UPDATE evidence_transfers SET status='Rejected', approved_by = ?, decision_remarks = COALESCE(?, decision_remarks), decision_date = NOW() WHERE transfer_id = ?",
      [req.user.user_id, remarks || null, transferId]
    );
    await conn.execute('INSERT INTO access_logs (user_id, evidence_id, action, timestamp) VALUES (?, ?, ?, NOW())', [req.user.user_id, t.evidence_id, `TRANSFER_REJECTED:${t.from_user}->${t.to_user}`]);
    await conn.commit();
    res.json({ msg: 'Rejected' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { createTransfer, getTransfersForEvidence, getAllTransfers, createTransferPublic, approveTransfer, rejectTransfer };


