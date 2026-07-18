/* MOB HQ backend — Express + Postgres.
   Provides private login and cross-device workspace sync.
   Deploy on Railway. The frontend (Netlify) talks to it over HTTPS. */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-railway';
const DATABASE_URL = process.env.DATABASE_URL;
// Comma-separated list of allowed frontend origins, or "*" for any.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Add a Postgres database in Railway and it will be provided automatically.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Railway/most managed Postgres need SSL; local dev does not.
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false }
});

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ---------- schema ---------- */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now()
    );`);
  console.log('DB ready.');
}

/* ---------- helpers ---------- */
function sign(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — sign in again' });
  }
}
const validEmail = e => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/* ---------- routes ---------- */
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'mob-hq' }));

// Whether the workspace already has an owner (controls whether "Create account" is offered).
app.get('/api/status', async (_req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  res.json({ registrationOpen: rows[0].n === 0 });
});

// Register — allowed ONLY for the very first user (the owner). Locked afterwards.
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const existing = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    if (existing.rows[0].n > 0) return res.status(403).json({ error: 'This workspace already has an owner. Sign in instead.' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email',
      [email.toLowerCase(), hash]
    );
    await pool.query('INSERT INTO workspaces (user_id, data) VALUES ($1, $2)', [rows[0].id, '{}']);
    res.json({ token: sign(rows[0]), email: rows[0].email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || !password) return res.status(400).json({ error: 'Email and password required' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Wrong email or password' });
    res.json({ token: sign(user), email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

// Load this owner's workspace state.
app.get('/api/state', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT data, updated_at FROM workspaces WHERE user_id=$1', [req.user.uid]);
  res.json({ data: rows[0] ? rows[0].data : {}, updatedAt: rows[0] ? rows[0].updated_at : null });
});

// Save this owner's workspace state (upsert).
app.put('/api/state', auth, async (req, res) => {
  const data = req.body && req.body.data;
  if (typeof data !== 'object' || data === null) return res.status(400).json({ error: 'Invalid data' });
  await pool.query(
    `INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [req.user.uid, data]
  );
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

initDb()
  .then(() => app.listen(PORT, () => console.log('MOB HQ backend listening on ' + PORT)))
  .catch(e => { console.error('DB init failed:', e); process.exit(1); });
