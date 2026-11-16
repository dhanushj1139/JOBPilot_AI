import sqlite3, os, threading
os.makedirs("data", exist_ok=True)
_lock = threading.Lock()
conn = sqlite3.connect("data/app.db", check_same_thread=False)
conn.row_factory = sqlite3.Row
conn.executescript("""
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, pw TEXT, salt TEXT,
  name TEXT, phone TEXT, location TEXT, job_title TEXT, resume_text TEXT, skills TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER);
CREATE TABLE IF NOT EXISTS portals(id INTEGER PRIMARY KEY, user_id INTEGER, portal TEXT, username TEXT, password_enc TEXT);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, source TEXT, title TEXT, company TEXT, location TEXT,
  description TEXT, url TEXT, posted TEXT, first_seen REAL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, score REAL,
  created REAL, seen INTEGER DEFAULT 0, UNIQUE(user_id, job_id));
""")
def q(sql, args=(), one=False):
    with _lock:
        cur = conn.execute(sql, args); conn.commit()
        rows = cur.fetchall()
    return (rows[0] if rows else None) if one else rows
