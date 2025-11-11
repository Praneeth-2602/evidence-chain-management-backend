const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SALT_ROUNDS = 12;

async function register(req, res, next) {
  const { name, first_name, last_name, email, password, role, department } = req.body;
  if (!email || !password || !(name || (first_name && last_name) || role)) return res.status(400).json({ msg: 'Missing fields' });
  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    try {
      const sql = `INSERT INTO users (name, email, password, role, department) VALUES (:name, :email, :password, :role, :department)`;
      const computedName = (name || `${first_name || ''} ${last_name || ''}`.trim()) || null;
      await db.execute(sql, {
        name: computedName,
        email: email || null,
        password: hashed,
        role: role ?? null,
        department: department ?? null,
      });
      return res.status(201).json({ msg: 'User created' });
    } catch (inner) {
      if (inner && inner.code === 'ER_BAD_FIELD_ERROR') {
        try {
          const sql2 = `INSERT INTO users (first_name, last_name, email, password, role) VALUES (:first_name, :last_name, :email, :password, :role)`;
          await db.execute(sql2, {
            first_name: (first_name ?? ((name || '').split(' ').slice(0, -1).join(' '))) || null,
            last_name: (last_name ?? ((name || '').split(' ').slice(-1).join(' '))) || null,
            email: email || null,
            password: hashed,
            role: role ?? null,
          });
          return res.status(201).json({ msg: 'User created' });
        } catch (err2) {
          if (err2 && err2.code === 'ER_BAD_FIELD_ERROR') {
            try {
              let roleId = null;
              if (role) {
                const [rrows] = await db.execute('SELECT role_id FROM roles WHERE role_name = ?', [role]);
                if (rrows && rrows[0]) roleId = rrows[0].role_id;
                else {
                  const [ins] = await db.execute('INSERT INTO roles (role_name) VALUES (?)', [role]);
                  roleId = ins.insertId;
                }
              }
              const sql3 = roleId
                ? `INSERT INTO users (first_name, last_name, email, password_hash, role_id) VALUES (:first_name, :last_name, :email, :password_hash, :role_id)`
                : `INSERT INTO users (first_name, last_name, email, password_hash) VALUES (:first_name, :last_name, :email, :password_hash)`;
              await db.execute(sql3, {
                first_name: (first_name ?? ((name || '').split(' ').slice(0, -1).join(' '))) || null,
                last_name: (last_name ?? ((name || '').split(' ').slice(-1).join(' '))) || null,
                email: email || null,
                password_hash: hashed,
                role_id: roleId ?? null,
              });
              return res.status(201).json({ msg: 'User created' });
            } catch (err3) {
              next(err3);
            }
          }
          next(err2);
        }
      } else {
        next(inner);
      }
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ msg: 'Email already exists' });
    next(err);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Missing email or password' });
  try {
    const schema = process.env.DB_NAME || process.env.MYSQL_DATABASE || null;
    let cols = new Set();
    try {
      if (schema) {
        const [colRows] = await db.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = 'users'`,
          { schema }
        );
        colRows.forEach(r => cols.add(r.COLUMN_NAME));
      } else {
        console.log('No schema/database name detected; skipping metadata lookup');
      }
    } catch (e) {
      console.error('Error fetching user columns:', e);
    }

    const selectParts = ['user_id', 'email'];
    if (cols.has('name')) selectParts.push('name');
    if (cols.has('first_name')) selectParts.push('first_name');
    if (cols.has('last_name')) selectParts.push('last_name');
    if (cols.has('password')) selectParts.push('password');
    if (cols.has('password_hash')) selectParts.push('password_hash');
    if (cols.has('role')) selectParts.push('role');
    if (cols.has('role_id')) selectParts.push('role_id');

    const selectClause = selectParts.join(', ');
    const [rows] = await db.execute(`SELECT ${selectClause} FROM users WHERE email = :email LIMIT 1`, { email });
    const user = rows[0];
    if (!user) return res.status(401).json({ msg: 'Invalid credentials' });

    const storedHash = user.password || user.password_hash;
    if (!storedHash) return res.status(500).json({ msg: 'No password column found for user' });

    const match = await bcrypt.compare(password, storedHash);
    if (!match) return res.status(401).json({ msg: 'Invalid credentials' });

    let roleName = user.role;
    if (!roleName && user.role_id) {
      try {
        const [rrows] = await db.execute('SELECT role_name FROM roles WHERE role_id = :id LIMIT 1', { id: user.role_id });
        if (rrows && rrows[0]) roleName = rrows[0].role_name;
      } catch (e) {
        console.error('Error fetching role name:', e);
      }
    }

    const displayName = user.name || ((user.first_name || '') + (user.last_name ? ' ' + user.last_name : '')).trim();

    const payload = { user_id: user.user_id, email: user.email, role: roleName };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ access_token: token, user: { user_id: user.user_id, name: displayName, email: user.email, role: roleName } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
