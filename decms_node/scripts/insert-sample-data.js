#!/usr/bin/env node
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'decms',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // helper: find or create user
    async function findOrCreateUser({ email, name, first_name, last_name, role = 'Investigator', department = 'Forensics', password = 'password' }) {
      const [rows] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
      if (rows.length) return rows[0].user_id;

      const hashed = await bcrypt.hash(password, 10);
      // Try to insert into 'name' schema first
      try {
        const [res] = await conn.query('INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)', [name || `${first_name || ''} ${last_name || ''}`.trim(), email, hashed, role, department]);
        return res.insertId;
      } catch (err) {
        // fallback to first_name/last_name
        if (err && err.code === 'ER_BAD_FIELD_ERROR') {
          try {
            const [res2] = await conn.query('INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)', [first_name || (name || '').split(' ').slice(0, -1).join(' '), last_name || (name || '').split(' ').slice(-1).join(' '), email, hashed, role]);
            return res2.insertId;
          } catch (err2) {
            // try password_hash and role_id variants
            if (err2 && err2.code === 'ER_BAD_FIELD_ERROR') {
              // determine role_id if needed
              let roleId = null;
              if (role) {
                const [rrows] = await conn.query('SELECT role_id FROM roles WHERE role_name = ?', [role]);
                if (rrows && rrows[0]) roleId = rrows[0].role_id;
                else {
                  const [ins] = await conn.query('INSERT INTO roles (role_name) VALUES (?)', [role]);
                  roleId = ins.insertId;
                }
              }
              const sql = roleId
                ? 'INSERT INTO users (first_name, last_name, email, password_hash, role_id) VALUES (?, ?, ?, ?, ?)'
                : 'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
              const params = roleId
                ? [first_name || (name || '').split(' ').slice(0, -1).join(' '), last_name || (name || '').split(' ').slice(-1).join(' '), email, hashed, roleId]
                : [first_name || (name || '').split(' ').slice(0, -1).join(' '), last_name || (name || '').split(' ').slice(-1).join(' '), email, hashed];
              const [res3] = await conn.query(sql, params);
              return res3.insertId;
            }
            throw err2;
          }
        }
        throw err;
      }
    }

    // helper: find or create storage location
    async function findOrCreateStorage({ name, location_details = 'Main Evidence Room', capacity = 100 }) {
      const [rows] = await conn.query('SELECT storage_id FROM storage_locations WHERE name = ?', [name]);
      if (rows.length) return rows[0].storage_id;
      const [res] = await conn.query('INSERT INTO storage_locations (name, location_details, capacity) VALUES (?, ?, ?)', [name, location_details, capacity]);
      return res.insertId;
    }

    // helper: find or create case
    async function findOrCreateCase({ case_title, description = '', assigned_to = null }) {
      const [rows] = await conn.query('SELECT case_id FROM cases WHERE case_title = ?', [case_title]);
      if (rows.length) return rows[0].case_id;
      const [res] = await conn.query('INSERT INTO cases (case_title, description, assigned_to) VALUES (?, ?, ?)', [case_title, description, assigned_to]);
      return res.insertId;
    }

    // helper: create evidence
    async function createEvidence({ case_id, collected_by, evidence_type = 'Digital', description = 'Sample evidence', storage_id = null, file_path = null, current_custodian_id = null }) {
      const [res] = await conn.query(
        'INSERT INTO evidence_items (case_id, collected_by, evidence_type, description, storage_id, current_custodian_id, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [case_id, collected_by, evidence_type, description, storage_id, current_custodian_id, file_path]
      );
      return res.insertId;
    }

    // helper: create transfer
    async function createTransfer({ evidence_id, from_user, to_user, remarks = 'Routine transfer' }) {
      const [res] = await conn.query('INSERT INTO evidence_transfers (evidence_id, from_user, to_user, remarks) VALUES (?, ?, ?, ?)', [evidence_id, from_user, to_user, remarks]);
      return res.insertId;
    }

    // helper: create report
    async function createReport({ evidence_id, analyst_id, findings = 'Initial findings: none', report_file = null }) {
      const [res] = await conn.query('INSERT INTO analysis_reports (evidence_id, analyst_id, findings, report_file) VALUES (?, ?, ?, ?)', [evidence_id, analyst_id, findings, report_file]);
      return res.insertId;
    }

    // Create sample users
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'adminpass';
    const adminId = await findOrCreateUser({ email: adminEmail, name: 'Admin User', role: 'Admin', department: 'Administration', password: adminPass });

    const officerId = await findOrCreateUser({ email: 'officer1@example.com', name: 'Officer One', role: 'Investigator', department: 'Investigation', password: 'officerpass' });
    const labId = await findOrCreateUser({ email: 'lab1@example.com', name: 'Lab Tech', role: 'Lab Staff', department: 'Lab', password: 'labpass' });

    console.log('Users ensured: adminId=%d, officerId=%d, labId=%d', adminId, officerId, labId);

    // Storage
    const storageId = await findOrCreateStorage({ name: 'Main Vault', location_details: 'Basement - Rack A', capacity: 500 });
    console.log('Storage ensured: storageId=%d', storageId);

    // Case
    const caseId = await findOrCreateCase({ case_title: 'SAMPLE-CASE-001', description: 'Sample case created for testing', assigned_to: officerId });
    console.log('Case ensured: caseId=%d', caseId);

    // Evidence
    const evidenceId = await createEvidence({ case_id: caseId, collected_by: officerId, evidence_type: 'USB Drive', description: 'Seized USB drive with suspect data', storage_id: storageId, file_path: 'uploads/sample_usb.img', current_custodian_id: adminId });
    console.log('Evidence created: evidenceId=%d', evidenceId);

    // Transfer: from admin to lab
    const transferId = await createTransfer({ evidence_id: evidenceId, from_user: adminId, to_user: labId, remarks: 'Sent for analysis' });
    console.log('Transfer recorded: transferId=%d', transferId);

    // Report
    const reportId = await createReport({ evidence_id: evidenceId, analyst_id: labId, findings: 'Initial analysis shows file fragments of interest', report_file: null });
    console.log('Report recorded: reportId=%d', reportId);

    await conn.commit();
    console.log('Sample data inserted successfully');
  } catch (err) {
    await conn.rollback();
    console.error('Error inserting sample data:', err.message || err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
