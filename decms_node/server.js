require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Simple CORS middleware for local development (adjust for production)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// static uploads
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/evidence', require('./routes/evidence'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', require('./routes/analytics'));

// health
app.get('/health', async (req, res) => {
  try {
    const db = require('./db');
    const [rows] = await db.query('SELECT 1 as ok');
    res.json({ ok: true, db: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// version
app.get('/version', (req, res) => {
  try {
    const pkg = require('./package.json');
    res.json({ name: pkg.name, version: pkg.version, description: pkg.description });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read package metadata' });
  }
});

// generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`DECMS Node backend listening on http://localhost:${PORT}`);
});
