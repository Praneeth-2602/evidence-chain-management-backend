#!/usr/bin/env node
// Seed historical evidence transfers across past months with variable volume and dates
// Safe strategy: create a dedicated seed case and seed evidence under it; only those items' custody will change

require('dotenv').config();
const db = require('../db');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function parseArg(name, defVal) {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (flag) {
    const v = flag.split('=')[1];
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return defVal;
}

async function ensureSeedUsers(conn) {
  // Pick a small pool of users to randomize from/to; fall back to self if database is sparse
  const [users] = await conn.execute('SELECT user_id FROM users ORDER BY user_id ASC LIMIT 6');
  if (!users.length) throw new Error('No users found. Seed users first.');
  return users.map(u => u.user_id);
}

async function ensureSeedCase(conn) {
  const title = 'History Seed Case';
  const [rows] = await conn.execute('SELECT case_id FROM cases WHERE case_title = ? LIMIT 1', [title]);
  if (rows.length) return rows[0].case_id;
  const [ins] = await conn.execute("INSERT INTO cases (case_title, description, status, created_at) VALUES (?, ?, 'Open', NOW())", [title, 'Auto-created for transfer history seeding']);
  return ins.insertId;
}

async function createSeedEvidence(conn, caseId, count = 3) {
  const created = [];
  for (let i = 0; i < count; i++) {
    const [ins] = await conn.execute(
      "INSERT INTO evidence_items (case_id, collected_by, evidence_type, description, storage_id, current_status, collected_on, current_custodian_id) VALUES (?, NULL, ?, ?, NULL, 'Collected', NOW(), NULL)",
      [caseId, 'Seeded Device', `Historical seed evidence #${i+1}`]
    );
    created.push(ins.insertId);
  }
  return created;
}

function randomDateInMonth(year, month /* 0-based */) {
  // Choose a random day within month, and a business-ish hour
  const day = randInt(1, new Date(year, month + 1, 0).getDate());
  const d = new Date(year, month, day, randInt(8, 19), randInt(0, 59), randInt(0, 59));
  return d;
}

async function seedTransfersVariable(conn, evidenceIds, userIds, options) {
  const { months, minPerMonth, maxPerMonth } = options;
  const now = new Date();
  for (let m = months; m >= 1; m--) {
    const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const count = randInt(minPerMonth, maxPerMonth);
    for (let i = 0; i < count; i++) {
      const evId = choice(evidenceIds);
      let from = choice(userIds);
      let to = choice(userIds);
      if (userIds.length > 1) {
        while (to === from) to = choice(userIds);
      }
      const when = randomDateInMonth(year, month);
      const remarks = `HIST_SEED ${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}-${String(when.getDate()).padStart(2,'0')}`;
      await conn.execute(
        'INSERT INTO evidence_transfers (evidence_id, from_user, to_user, remarks, transfer_date) VALUES (?, ?, ?, ?, ?)',
        [evId, from, to, remarks, when]
      );
    }
  }
}

(async () => {
  const conn = await db.getConnection();
  const months = parseInt(parseArg('months', process.env.SEED_MONTHS || 8));
  const minPerMonth = parseInt(parseArg('min', process.env.SEED_MIN_PER_MONTH || 1));
  const maxPerMonth = parseInt(parseArg('max', process.env.SEED_MAX_PER_MONTH || 6));
  const evidenceCount = parseInt(parseArg('evidence', process.env.SEED_EVIDENCE_COUNT || 4));
  const reset = process.argv.includes('--reset');
  try {
    console.log(`Seeding historical transfers (months=${months}, perMonth=${minPerMonth}-${maxPerMonth}, evidence=${evidenceCount})...`);
    await conn.beginTransaction();
    if (reset) {
      console.log('Reset flag detected: removing previous HIST_SEED transfers...');
      await conn.execute("DELETE FROM evidence_transfers WHERE remarks LIKE 'HIST_SEED %'");
    }
    const userIds = await ensureSeedUsers(conn);
    const caseId = await ensureSeedCase(conn);
    const evidenceIds = await createSeedEvidence(conn, caseId, evidenceCount);
    await seedTransfersVariable(conn, evidenceIds, userIds, { months, minPerMonth, maxPerMonth });
    await conn.commit();
    console.log(`Seeded variable transfers across ${months} months.`);
  } catch (err) {
    await conn.rollback();
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
})();
