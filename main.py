import os, io, re, json, time, secrets, hashlib, smtplib, threading
from datetime import datetime, timezone
from email.message import EmailMessage
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from cryptography.fernet import Fernet
from apscheduler.schedulers.background import BackgroundScheduler
try:
    from dotenv import load_dotenv; load_dotenv()
except ImportError:
    if os.path.exists(".env"):
        for l in open(".env"):
            if "=" in l and not l.startswith("#"):
                k, v = l.strip().split("=", 1); os.environ.setdefault(k, v)
from db import q
import matcher, connectors

# ---- encryption for portal passwords ----
KF = "data/secret.key"
if not os.path.exists(KF): open(KF, "wb").write(Fernet.generate_key())
fernet = Fernet(open(KF, "rb").read())

app = FastAPI(title="JobHunter AI")
app.mount("/static", StaticFiles(directory="static"), name="static")

def hpw(pw, salt): return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 150000).hex()
def me(authorization: str = Header(None)):
    t = (authorization or "").replace("Bearer ", "")
    r = q("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=?", (t,), one=True)
    if not r: raise HTTPException(401, "Not logged in")
    return r

class Auth(BaseModel): email: str; password: str
@app.post("/api/register")
def register(a: Auth):
    if q("SELECT 1 FROM users WHERE email=?", (a.email.lower(),), one=True): raise HTTPException(400, "Email already registered")
    salt = secrets.token_hex(8)
    q("INSERT INTO users(email,pw,salt) VALUES(?,?,?)", (a.email.lower(), hpw(a.password, salt), salt))
    return login(a)
@app.post("/api/login")
def login(a: Auth):
    u = q("SELECT * FROM users WHERE email=?", (a.email.lower(),), one=True)
    if not u or u["pw"] != hpw(a.password, u["salt"]): raise HTTPException(401, "Wrong email or password")
    t = secrets.token_hex(24); q("INSERT INTO sessions VALUES(?,?)", (t, u["id"])); return {"token": t}

@app.get("/api/profile")
def get_profile(u=Depends(me)):
    return {k: u[k] for k in ("email", "name", "phone", "location", "job_title")} | {
        "skills": json.loads(u["skills"]), "has_resume": bool(u["resume_text"]),
        "portals": [r["portal"] for r in q("SELECT portal FROM portals WHERE user_id=?", (u["id"],))]}

def read_resume(f: UploadFile):
    data, name = f.file.read(), f.filename.lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
    if name.endswith(".docx"):
        import docx
        return "\n".join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs)
    return data.decode("utf-8", "ignore")

@app.post("/api/profile")
def save_profile(name: str = Form(""), phone: str = Form(""), location: str = Form(""), job_title: str = Form(""),
                 resume: UploadFile = File(None), u=Depends(me)):
    q("UPDATE users SET name=?,phone=?,location=?,job_title=? WHERE id=?", (name, phone, location, job_title, u["id"]))
    if resume and resume.filename:
        text = read_resume(resume)
        if len(text.strip()) < 50: raise HTTPException(400, "Could not read text from resume (scanned PDF?)")
        q("UPDATE users SET resume_text=?, skills=? WHERE id=?", (text, json.dumps(matcher.extract_skills(text)), u["id"]))
    return get_profile(me_by_id(u["id"]))
def me_by_id(i): return q("SELECT * FROM users WHERE id=?", (i,), one=True)

class Skills(BaseModel): skills: list[str]
@app.put("/api/skills")
def set_skills(s: Skills, u=Depends(me)):
    q("UPDATE users SET skills=? WHERE id=?", (json.dumps(sorted({x.lower().strip() for x in s.skills if x.strip()})), u["id"]))
    return {"ok": True}

class Portal(BaseModel): portal: str; username: str = ""; password: str = ""
@app.post("/api/portals")
def add_portal(p: Portal, u=Depends(me)):
    q("DELETE FROM portals WHERE user_id=? AND portal=?", (u["id"], p.portal))
    q("INSERT INTO portals(user_id,portal,username,password_enc) VALUES(?,?,?,?)",
      (u["id"], p.portal, p.username, fernet.encrypt(p.password.encode()).decode())); return {"ok": True}
@app.delete("/api/portals/{portal}")
def del_portal(portal: str, u=Depends(me)):
    q("DELETE FROM portals WHERE user_id=? AND portal=?", (u["id"], portal)); return {"ok": True}

# ---- job fetching ----
def iso(v):
    t = connectors.parse_posted(v)
    return datetime.fromtimestamp(t, timezone.utc).isoformat() if t else ""

def fetch_for_queries(queries):
    new_ids = []
    for query, loc, creds in queries:
        batch = []
        for fn in connectors.PUBLIC:
            try: batch += fn(query, location=loc)
            except Exception as e: print(f"[{fn.__name__}] failed:", e)
        for portal, user, pw in creds:
            try: batch += connectors.logged_in_portal(portal, user, pw, query, loc)
            except Exception as e: print(f"[{portal}] failed:", e)
        for j in batch:
            if not j.get("url"): continue
            jid = connectors.job_id(j)
            if not q("SELECT 1 FROM jobs WHERE id=?", (jid,), one=True):
                q("INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?)", (jid, j["source"], j["title"], j["company"], j["location"],
                  j["description"][:6000], j["url"], iso(j["posted"]), time.time())); new_ids.append(jid)
    return new_ids

def refresh_all(only_user=None):
    users = [only_user] if only_user else q("SELECT * FROM users WHERE job_title != '' AND job_title IS NOT NULL")
    queries = []
    for u in users:
        creds = [(p["portal"], p["username"], fernet.decrypt(p["password_enc"].encode()).decode())
                 for p in q("SELECT * FROM portals WHERE user_id=?", (u["id"],))]
        queries.append((u["job_title"], u["location"] or "", creds))
        for s in json.loads(u["skills"] or "[]")[:2]: queries.append((f"{u['job_title']} {s}", u["location"] or "", []))
    new_ids = fetch_for_queries(queries)
    notify(new_ids)
    return len(new_ids)

def notify(new_ids):
    if not new_ids: return
    jobs = [r for i in new_ids for r in q("SELECT * FROM jobs WHERE id=?", (i,))]
    thr = float(os.getenv("MIN_NOTIFY_SCORE", 35))
    for u in q("SELECT * FROM users WHERE resume_text IS NOT NULL"):
        hits = [(j, s) for j, s, _ in matcher.score_jobs(u, jobs) if s >= thr]
        for j, s in hits:
            q("INSERT OR IGNORE INTO notifications(user_id,job_id,score,created) VALUES(?,?,?,?)", (u["id"], j["id"], s, time.time()))
        if hits and os.getenv("SMTP_HOST"): send_mail(u["email"], hits)

def send_mail(to, hits):
    try:
        m = EmailMessage(); m["To"] = to; m["From"] = os.getenv("SMTP_USER"); m["Subject"] = f"{len(hits)} new job matches"
        m.set_content("\n\n".join(f"{j['title']} - {j['company']} ({s}% match, via {j['source']})\n{j['url']}" for j, s in hits[:20]))
        with smtplib.SMTP(os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", 587))) as sm:
            sm.starttls(); sm.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS")); sm.send_message(m)
    except Exception as e: print("mail failed", e)

@app.post("/api/refresh")
def refresh(u=Depends(me)):
    if not u["job_title"]: raise HTTPException(400, "Save a job title first")
    return {"new_jobs": refresh_all(u)}

def jobd(j, s, m): return dict(id=j["id"], title=j["title"], company=j["company"], location=j["location"], source=j["source"],
    url=j["url"], posted=j["posted"], score=s, matched_skills=m, snippet=(j["description"] or "")[:300], first_seen=j["first_seen"],
    ts=posted_ts(j))
def posted_ts(j): return connectors.parse_posted(j["posted"]) or j["first_seen"]

def loc_ok(j, tokens, remote):
    if not tokens: return True
    text = f"{j['location'] or ''} {j['title']}".lower()
    if remote and re.search(r"remote|anywhere|worldwide|work from home", text): return True
    return any(t in text for t in tokens)

@app.get("/api/jobs")
def jobs(min_score: float = 0, source: str = "", location: str = "", remote: int = 1, sort: str = "recent",
         days: int = 0, u=Depends(me)):
    rows = q("SELECT * FROM jobs WHERE source=?", (source,)) if source else q("SELECT * FROM jobs")
    tokens = [t.strip().lower() for t in re.split(r"[,;/]", location) if t.strip()]
    cutoff = time.time() - days * 86400 if days else 0
    rows = [j for j in rows if loc_ok(j, tokens, remote) and posted_ts(j) >= cutoff]
    out = [jobd(j, s, m) for j, s, m in matcher.score_jobs(u, rows) if s >= min_score]
    out.sort(key=(lambda x: -x["ts"]) if sort == "recent" else (lambda x: -x["score"]))
    return out[:200]
@app.get("/api/jobs/{jid}/explain")
def explain(jid: str, u=Depends(me)):
    j = q("SELECT * FROM jobs WHERE id=?", (jid,), one=True)
    if not j: raise HTTPException(404)
    return {"text": matcher.explain(u, j)}

@app.get("/api/notifications")
def notifs(u=Depends(me)):
    rows = q("""SELECT n.id,n.score,n.created,n.seen,j.title,j.company,j.source,j.url FROM notifications n
                JOIN jobs j ON j.id=n.job_id WHERE n.user_id=? ORDER BY n.created DESC LIMIT 50""", (u["id"],))
    return [dict(r) for r in rows]
@app.post("/api/notifications/seen")
def seen(u=Depends(me)):
    q("UPDATE notifications SET seen=1 WHERE user_id=?", (u["id"],)); return {"ok": True}

@app.get("/")
def index(): return FileResponse("static/index.html")

@app.on_event("startup")
def start():
    sch = BackgroundScheduler(); sch.add_job(refresh_all, "interval", minutes=int(os.getenv("REFRESH_MINUTES", 30)))
    sch.start()
