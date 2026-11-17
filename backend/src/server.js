require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const db = require('./db');
const auth = require('./auth');
const crypto = require('./crypto');
const resume = require('./resume');
const providers = require('./providers');
const sched = require('./scheduler');
const { blended } = require('./ats');
const notify = require('./notify');

for (const k of ['JWT_SECRET', 'ENC_KEY']) if (!process.env[k]) { console.error(`Missing ${k} in .env`); process.exit(1); }

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.status || 500).json({ error: e.message }));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const ME = auth.requireAuth;

// ---- Page 1: auth
app.post('/api/auth/register', limiter, wrap(async (q, r) => r.json({ token: await auth.register(q.body.email, q.body.password) })));
app.post('/api/auth/login', limiter, wrap(async (q, r) => r.json({ token: await auth.login(q.body.email, q.body.password) })));

// ---- Page 2: portals, resume, preferences
app.get('/api/portals', ME, (q, r) => {
  const mine = db.prepare('SELECT provider FROM portal_connections WHERE user_id=?').all(q.uid).map((x) => x.provider);
  r.json(providers.names().map((p) => ({ ...p, connected: mine.includes(p.name) })));
});
// Stores an API key or OAuth token (encrypted). Raw site passwords are rejected on purpose.
app.post('/api/portals/:name', ME, wrap(async (q, r) => {
  if (!providers.get(q.params.name)) return r.status(404).json({ error: 'Unknown portal' });
  const { token } = q.body; if (!token) return r.status(400).json({ error: 'token required (OAuth or API token, not a password)' });
  db.prepare('INSERT OR REPLACE INTO portal_connections VALUES(?,?,?,?)').run(q.uid, q.params.name, crypto.encrypt({ token }), Date.now());
  r.json({ ok: true });
}));
app.delete('/api/portals/:name', ME, (q, r) => {
  db.prepare('DELETE FROM portal_connections WHERE user_id=? AND provider=?').run(q.uid, q.params.name); r.json({ ok: true });
});

async function saveResume(uid, text) {
  if (text.trim().length < 40) throw Object.assign(new Error('No readable text found. Scanned PDFs need OCR; paste the text instead.'), { status: 400 });
  const ex = await resume.extractSkills(text);
  db.prepare('UPDATE profiles SET resume_text=?, skills=?, titles=? WHERE user_id=?')
    .run(text, JSON.stringify(resume.technicalList(ex.skills)), JSON.stringify(ex.titles), uid);
  return ex;
}
app.post('/api/resume', ME, upload.single('file'), wrap(async (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'file required' });
  const text = await resume.parseFile(q.file);
  r.json({ text, ...(await saveResume(q.uid, text)) });
}));
app.post('/api/resume/text', ME, wrap(async (q, r) => r.json(await saveResume(q.uid, q.body.text || ''))));

app.get('/api/me', ME, (q, r) => r.json(db.prepare('SELECT email FROM users WHERE id=?').get(q.uid) || {}));
app.get('/api/profile', ME, (q, r) => r.json(db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid)));
app.put('/api/profile', ME, wrap(async (q, r) => {
  const b = q.body, cur = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid);
  const auto = b.auto_apply ? 1 : 0;
  if (auto && !b.consent) return r.status(400).json({ error: 'Auto-apply needs explicit consent' });
  db.prepare('UPDATE profiles SET skills=?,titles=?,country=?,city=?,auto_apply=?,consent_at=?,threshold=? WHERE user_id=?').run(
    JSON.stringify(b.skills ?? JSON.parse(cur.skills)), JSON.stringify(b.titles ?? JSON.parse(cur.titles)),
    b.country ?? cur.country, b.city ?? cur.city, auto, auto ? (cur.consent_at || Date.now()) : null,
    Math.min(100, Math.max(50, b.threshold ?? cur.threshold)), q.uid);
  sched.runForUser(db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid)).catch(() => {}); // first fetch right away
  r.json({ ok: true });
}));

// ---- Page 3: jobs. Preferred city first, then newest to oldest, last 24h, one country.
app.get('/api/jobs', ME, (q, r) => {
  const p = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid);
  const country = q.query.country || p.country, min = Number(q.query.minScore) || 0;
  const rows = db.prepare(`SELECT j.id,j.title,j.company,j.city,j.country,j.url,j.posted_at,j.provider AS source,
      m.score,m.status,m.note, (j.city = ? COLLATE NOCASE) AS preferred
    FROM matches m JOIN jobs j ON j.id=m.job_id
    WHERE m.user_id=? AND j.country=? AND j.posted_at>? AND m.score>=? AND (?='' OR j.provider=?)
    ORDER BY preferred DESC, j.posted_at DESC LIMIT 200`)
    .all(p.city || '', q.uid, country, Date.now() - 30 * 864e5, min, q.query.source || '', q.query.source || '');
  r.json(rows);
});
// Alerts = jobs matched since the given time (the client sends when this session began).
app.get('/api/alerts', ME, (q, r) => r.json(db.prepare(`SELECT j.id,j.title,j.company,j.city,j.url,j.provider AS source,m.score,m.status,m.created_at
  FROM matches m JOIN jobs j ON j.id=m.job_id WHERE m.user_id=? AND m.created_at>? ORDER BY m.created_at DESC LIMIT 30`).all(q.uid, Number(q.query.since) || 0)));
app.post('/api/jobs/:id/apply', ME, wrap(async (q, r) => {
  if (!db.prepare('SELECT 1 FROM matches WHERE user_id=? AND job_id=?').get(q.uid, q.params.id)) return r.status(404).json({ error: 'Not found' });
  r.json({ status: await sched.applyJob(q.uid, Number(q.params.id)) });
}));
app.post('/api/refresh', ME, wrap(async (q, r) => r.json({ added: await sched.runForUser(db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid)) })));
app.get('/api/notifications/stream', ME, (q, r) => notify.subscribe(q.uid, r));
// Demo mode: ready-made account and sample jobs, no keys needed.
const DEMO = { email: 'demo@jobpilot.app', password: 'Demo@1234' };
app.get('/api/demo', (q, r) => r.json(process.env.DEMO_MODE === '1' ? { demo: true, ...DEMO } : { demo: false }));
// Demo only: add a job by hand. It is scored, alerted and (if eligible) auto-applied like any fetched job.
app.post('/api/demo/job', ME, wrap(async (q, r) => {
  if (process.env.DEMO_MODE !== '1') return r.status(404).json({ error: 'Available in demo mode only' });
  const b = q.body || {}, p = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(q.uid);
  const title = String(b.title || '').trim().slice(0, 100);
  if (!title) return r.status(400).json({ error: 'Job title is required' });
  const skills = String(b.skills || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 15);
  const ext = 'manual-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const job = { provider: 'demo', ext_id: ext, title, company: String(b.company || 'Demo Company').trim().slice(0, 80),
    country: p.country, city: String(b.city || p.city || '').trim().slice(0, 60),
    description: `We are hiring a ${title}. Required skills: ${skills.join(', ')}.`, url: 'https://example.com/jobs/' + ext, posted_at: Date.now() };
  const id = db.prepare(`INSERT INTO jobs(provider,ext_id,title,company,country,city,description,url,posted_at)
    VALUES(@provider,@ext_id,@title,@company,@country,@city,@description,@url,@posted_at) RETURNING id`).get(job).id;
  const score = await blended(p, job);
  db.prepare('INSERT OR IGNORE INTO matches(user_id,job_id,score,status,created_at) VALUES(?,?,?,?,?)').run(q.uid, id, score, 'review', Date.now());
  notify.push(q.uid, 'new_job', { id, title, company: job.company, city: job.city, score, url: job.url });
  if (p.auto_apply && p.consent_at && score >= p.threshold) await sched.applyJob(q.uid, id);
  r.json({ id, score });
}));

async function seedDemo() {
  try { await auth.register(DEMO.email, DEMO.password); } catch {}
  const u = db.prepare('SELECT id FROM users WHERE email=?').get(DEMO.email);
  const p = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(u.id);
  if (JSON.parse(p.skills || '[]').length === 0)
    db.prepare('UPDATE profiles SET resume_text=?,skills=?,titles=?,country=?,city=?,auto_apply=1,consent_at=?,threshold=75 WHERE user_id=?').run(
      'Software engineer with 4 years of experience. Skills: Python, Django, React, SQL, PostgreSQL, Docker, AWS, Git, REST API.',
      JSON.stringify(['python', 'django', 'react', 'sql', 'postgresql', 'docker', 'aws', 'git', 'rest api']),
      JSON.stringify(['Software Engineer', 'Backend Developer']), 'India', 'Hyderabad', Date.now(), u.id);
  await sched.runForUser(db.prepare('SELECT * FROM profiles WHERE user_id=?').get(u.id));
}

app.get('/health', (q, r) => r.json({ ok: true }));

// Serve the web app from the same server, so the whole project runs on one address.
const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
if (fs.existsSync(FRONTEND)) app.use(express.static(FRONTEND));

const port = process.env.PORT || 4000;
app.listen(port, () => { console.log('JobPilot is running. Open http://localhost:' + port); sched.start(); if (process.env.DEMO_MODE === '1') seedDemo().then(() => console.log('Demo mode on. Sign in with ' + DEMO.email + ' / ' + DEMO.password)).catch((e) => console.warn(e.message)); });
