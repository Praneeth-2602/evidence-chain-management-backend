require('dotenv').config();
const fetch = global.fetch || require('node-fetch');

async function run() {
  const API = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    console.error('Please set TEST_EMAIL and TEST_PASSWORD in .env to run this test');
    process.exit(1);
  }

  console.log('Logging in as', email);
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  console.log('Login response status:', res.status);
  console.log(data);
  if (!res.ok) process.exit(2);

  const token = data.access_token;
  if (!token) {
    console.error('No token returned');
    process.exit(3);
  }

  console.log('Testing access to protected /api/cases (requires Admin)');
  const r2 = await fetch(`${API}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('/api/cases status', r2.status);
  try {
    console.log(await r2.json());
  } catch (e) { /* ignore */ }
}

run().catch(err => { console.error(err); process.exit(99); });
