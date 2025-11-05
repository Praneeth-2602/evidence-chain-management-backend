const db = require('../db');
const fs = require('fs');
const path = require('path');

// Helper: resolve storage_id from provided storage_location value (id or name)
async function resolveStorageId(conn, storage_location) {
  if (storage_location === undefined || storage_location === null || storage_location === '') return null;

  // If it's a number or numeric string, use as-is
  if (typeof storage_location === 'number') return storage_location;
  if (typeof storage_location === 'string' && /^\d+$/.test(storage_location)) return parseInt(storage_location, 10);

  // Otherwise treat as a storage name; find or create
  const name = String(storage_location).trim();
  if (!name) return null;
  const [found] = await conn.execute('SELECT storage_id FROM storage_locations WHERE name = ? LIMIT 1', [name]);
  if (found.length) return found[0].storage_id;

  const [ins] = await conn.execute(
    'INSERT INTO storage_locations (name, location_details, capacity, status) VALUES (?, ?, ?, ?)',
    [name, null, 0, 'Active']
  );
  return ins.insertId;
}

async function createEvidence(req, res, next) {
  const { case_id, evidence_type, description, storage_location } = req.body;
  const file = req.file;
  if (!case_id || !evidence_type) return res.status(400).json({ msg: 'Missing fields' });
  const conn = await db.getConnection();
  try {
    const file_path = file ? path.relative(process.cwd(), file.path) : null;
    const storage_id = await resolveStorageId(conn, storage_location);
    const sql = `INSERT INTO evidence_items (case_id, collected_by, evidence_type, description, storage_id, current_status, collected_on, file_path) VALUES (:case_id, :collected_by, :evidence_type, :description, :storage_id, 'Collected', NOW(), :file_path)`;
    const params = { case_id, collected_by: req.user.user_id, evidence_type, description, storage_id, file_path };
    const [result] = await conn.execute(sql, params);
    res.status(201).json({ evidence_id: result.insertId });
  } catch (err) { next(err); } finally { conn.release(); }
}

async function getEvidence(req, res, next) {
  const id = req.params.id;
  try {
    const [rows] = await db.execute('SELECT * FROM evidence_items WHERE evidence_id = :id', { id });
    if (!rows[0]) return res.status(404).json({ msg: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function getEvidenceByCase(req, res, next) {
  const caseId = req.params.caseId;
  try {
    const [rows] = await db.execute('SELECT * FROM evidence_items WHERE case_id = :caseId', { caseId });
    res.json(rows);
  } catch (err) { next(err); }
}

// Public: list evidence items with enriched fields (collected_by name and storage name)
async function getAllEvidencePublic(req, res, next) {
  try {
    // Determine name expression based on users schema
    const [cols] = await db.execute(
      `SELECT COUNT(*) AS has_name
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'name'`
    );
    const useSingleName = cols[0]?.has_name > 0;
    const nameExpr = (alias) => useSingleName
      ? `${alias}.name`
      : `CONCAT(COALESCE(${alias}.first_name,''), ' ', COALESCE(${alias}.last_name,''))`;

    const [rows] = await db.execute(
      `SELECT e.evidence_id, e.case_id, e.evidence_type, e.description, e.current_status, e.collected_on,
              e.current_custodian_id,
              u.user_id AS collected_by_id,
              ${nameExpr('u')} AS collected_by_name,
              s.storage_id, s.name AS storage_name,
              ${nameExpr('c')} AS custodian_name
         FROM evidence_items e
         LEFT JOIN users u ON e.collected_by = u.user_id
         LEFT JOIN users c ON e.current_custodian_id = c.user_id
         LEFT JOIN storage_locations s ON e.storage_id = s.storage_id
        ORDER BY e.collected_on DESC
        LIMIT 200`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function updateEvidence(req, res, next) {
  const id = req.params.id;
  const { current_status } = req.body; // Collected, Under Analysis, Archived
  try {
    await db.execute('UPDATE evidence_items SET current_status = :current_status WHERE evidence_id = :id', { current_status, id });
    // Access log will be recorded on DB trigger; but we can also insert application-side
    await db.execute('INSERT INTO access_logs (user_id, evidence_id, action, timestamp) VALUES (:user_id, :evidence_id, :action, NOW())', { user_id: req.user.user_id, evidence_id: id, action: `STATUS:${current_status}` });
    res.json({ msg: 'Updated' });
  } catch (err) { next(err); }
}

async function deleteEvidence(req, res, next) {
  const id = req.params.id;
  try {
    const [rows] = await db.execute('SELECT current_status, file_path FROM evidence_items WHERE evidence_id = :id', { id });
    if (!rows[0]) return res.status(404).json({ msg: 'Not found' });
    if (rows[0].current_status === 'Under Analysis') return res.status(400).json({ msg: 'Cannot delete while Under Analysis' });
    const [del] = await db.execute('DELETE FROM evidence_items WHERE evidence_id = :id', { id });
    if (rows[0].file_path) {
      try { fs.unlinkSync(path.resolve(rows[0].file_path)); } catch (e) { /* ignore */ }
    }
    res.json({ msg: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { createEvidence, getEvidence, getEvidenceByCase, updateEvidence, deleteEvidence, getAllEvidencePublic, createEvidencePublic };

// Public createEvidence: accepts collected_by_email or collected_by_name and optional file upload
async function createEvidencePublic(req, res, next) {
  const { case_id, evidence_type, description, storage_location, collected_by_email, collected_by_name } = req.body;
  const file = req.file;
  if (!case_id || !evidence_type) return res.status(400).json({ msg: 'Missing fields' });
  const conn = await db.getConnection();
  try {
    // resolve collected_by id
    let collected_by = null;
    if (collected_by_email) {
      const [r] = await conn.execute('SELECT user_id FROM users WHERE email = ? LIMIT 1', [collected_by_email]);
      if (r.length) collected_by = r[0].user_id;
    }
    if (!collected_by && collected_by_name) {
      // Try single 'name' column first
      try {
        const [rn] = await conn.execute('SELECT user_id FROM users WHERE name = ? LIMIT 1', [collected_by_name]);
        if (rn.length) collected_by = rn[0].user_id;
      } catch (e) { /* ignore */ }

      if (!collected_by) {
        try {
          const [cols] = await conn.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
          );
          const cset = new Set(cols.map((c) => c.COLUMN_NAME));
          if (cset.has('first_name') && cset.has('last_name')) {
            const parts = collected_by_name.trim().split(/\s+/);
            if (parts.length >= 2) {
              const first = parts[0];
              const last = parts.slice(1).join(' ');
              const [r2] = await conn.execute('SELECT user_id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1', [first, last]);
              if (r2.length) collected_by = r2[0].user_id;
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    const file_path = file ? path.relative(process.cwd(), file.path) : null;
    const storage_id = await resolveStorageId(conn, storage_location);
    const sql = `INSERT INTO evidence_items (case_id, collected_by, evidence_type, description, storage_id, current_status, collected_on, file_path, current_custodian_id) VALUES (:case_id, :collected_by, :evidence_type, :description, :storage_id, 'Collected', NOW(), :file_path, :collected_by)`;
    const params = { case_id, collected_by: collected_by ?? null, evidence_type, description, storage_id, file_path };
    const [result] = await conn.execute(sql, params);
    res.status(201).json({ evidence_id: result.insertId });
  } catch (err) { next(err); }
  finally { conn.release(); }
}
