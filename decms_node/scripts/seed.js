/**
 * Simple seeding script to create initial roles and an admin user.
 * Run: npm run seed
 */
require('dotenv').config();
const db = require('../db');
const bcrypt = require('bcrypt');

async function main() {
  try {
    // create an admin user if not exists
    const fullName = 'Admin User';
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'adminpass';
    const role = 'Admin';
    const hashed = await bcrypt.hash(password, 12);

    // Try the 'name' schema first (our SQL file). If the existing DB uses first_name/last_name (Flask app), handle that.
    try {
      const sql = 'INSERT IGNORE INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)';
      await db.execute(sql, [fullName, email, hashed, role, 'Administration']);
      console.log('Seed complete (name column). Admin:', email);
      process.exit(0);
    } catch (innerErr) {
      if (innerErr && innerErr.code === 'ER_BAD_FIELD_ERROR' && /name/.test(String(innerErr.sqlMessage))) {
        // Try alternate schema with first_name/last_name
        const parts = fullName.split(' ');
        const first_name = parts.slice(0, -1).join(' ') || parts[0];
        const last_name = parts.slice(-1).join(' ') || '';
        // first try column 'password'
        try {
          const sql2 = 'INSERT IGNORE INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)';
          await db.execute(sql2, [first_name, last_name, email, hashed, role]);
          console.log('Seed complete (first_name/last_name + password). Admin:', email);
          process.exit(0);
        } catch (err2) {
          // if password column missing, try password_hash
          if (err2 && err2.code === 'ER_BAD_FIELD_ERROR' && /password/.test(String(err2.sqlMessage))) {
            // Try inserting with password_hash and role column; if role column is missing we'll handle below
            try {
              const sql3 = 'INSERT IGNORE INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)';
              await db.execute(sql3, [first_name, last_name, email, hashed, role]);
              console.log('Seed complete (first_name/last_name + password_hash). Admin:', email);
              process.exit(0);
            } catch (err3) {
              // If role column does not exist (Flask schema uses role_id), create/find role and insert with role_id
              if (err3 && err3.code === 'ER_BAD_FIELD_ERROR' && /role/.test(String(err3.sqlMessage))) {
                // Ensure role exists in roles table
                let roleId = null;
                const [roleRows] = await db.execute('SELECT role_id FROM roles WHERE role_name = ?', [role]);
                if (roleRows && roleRows[0]) roleId = roleRows[0].role_id;
                else {
                  const [ins] = await db.execute('INSERT INTO roles (role_name) VALUES (?)', [role]);
                  roleId = ins.insertId;
                }
                // Insert user using role_id and password_hash
                const sql4 = 'INSERT IGNORE INTO users (first_name, last_name, email, password_hash, role_id) VALUES (?, ?, ?, ?, ?)';
                await db.execute(sql4, [first_name, last_name, email, hashed, roleId]);
                console.log('Seed complete (first_name/last_name + password_hash + role_id). Admin:', email);
                process.exit(0);
              }
              throw err3;
            }
          }
          throw err2;
        }
      }
      throw innerErr;
    }
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
