const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const secret = () => process.env.JWT_SECRET;

exports.register = async (email, password) => {
  if (!/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8)
    throw Object.assign(new Error('Valid email and a password of 8+ characters required'), { status: 400 });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase()))
    throw Object.assign(new Error('Email already registered'), { status: 409 });
  const hash = await bcrypt.hash(password, 12);
  const r = db.prepare('INSERT INTO users(email,pass_hash,created_at) VALUES(?,?,?)').run(email.toLowerCase(), hash, Date.now());
  db.prepare('INSERT INTO profiles(user_id) VALUES(?)').run(r.lastInsertRowid);
  return sign(r.lastInsertRowid);
};
exports.login = async (email, password) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!u || !(await bcrypt.compare(password || '', u.pass_hash)))
    throw Object.assign(new Error('Wrong email or password'), { status: 401 });
  return sign(u.id);
};
const sign = (id) => jwt.sign({ uid: Number(id) }, secret(), { expiresIn: '7d' });

// Bearer header, or ?token= for EventSource (which cannot set headers)
exports.requireAuth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  try { req.uid = jwt.verify(t, secret()).uid; next(); }
  catch { res.status(401).json({ error: 'Sign in required' }); }
};
