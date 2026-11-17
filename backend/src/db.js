const Database = require('better-sqlite3');
const db = new Database(process.env.DB_FILE || './jobpilot.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  resume_text TEXT DEFAULT '', skills TEXT DEFAULT '[]', titles TEXT DEFAULT '[]',
  country TEXT DEFAULT 'India', city TEXT DEFAULT '',
  auto_apply INTEGER DEFAULT 0, consent_at INTEGER, threshold INTEGER DEFAULT 75);
CREATE TABLE IF NOT EXISTS portal_connections(
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL,
  enc_blob TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, provider));
CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY, provider TEXT NOT NULL, ext_id TEXT NOT NULL, title TEXT NOT NULL,
  company TEXT, country TEXT, city TEXT, description TEXT, url TEXT, posted_at INTEGER NOT NULL,
  UNIQUE(provider, ext_id));
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_at DESC);
CREATE TABLE IF NOT EXISTS matches(
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  score INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'review',
  created_at INTEGER NOT NULL, applied_at INTEGER, note TEXT,
  PRIMARY KEY(user_id, job_id));
`);
module.exports = db;
