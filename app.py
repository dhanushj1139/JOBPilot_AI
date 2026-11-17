from flask import Flask, render_template, request, redirect, url_for, flash
import sqlite3
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "jobpilot.db"

app = Flask(__name__)
# Local-development secret is configured in code; change before public deployment.
app.config["SECRET_KEY"] = "jobpilot-local-development-key-change-before-deployment"

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT,
                job_type TEXT,
                experience TEXT,
                salary TEXT,
                skills TEXT,
                description TEXT,
                apply_url TEXT,
                status TEXT NOT NULL DEFAULT 'Saved',
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()

@app.route("/")
def home():
    return redirect(url_for("dashboard"))

@app.route("/dashboard")
def dashboard():
    search = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    query = "SELECT * FROM jobs WHERE 1=1"
    params = []
    if search:
        query += " AND (title LIKE ? OR company LIKE ? OR skills LIKE ? OR location LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY id DESC"
    with get_db() as conn:
        jobs = conn.execute(query, params).fetchall()
        total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        saved = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='Saved'").fetchone()[0]
        applied = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='Applied'").fetchone()[0]
        interview = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='Interview'").fetchone()[0]
    return render_template("dashboard.html", jobs=jobs, total=total, saved=saved,
                           applied=applied, interview=interview, q=search, selected_status=status)

@app.route("/add-job", methods=["GET", "POST"])
def add_job():
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        company = request.form.get("company", "").strip()
        if not title or not company:
            flash("Job title and company are required.", "error")
            return render_template("add_job.html", form=request.form)
        values = (
            title, company, request.form.get("location", "").strip(),
            request.form.get("job_type", "").strip(), request.form.get("experience", "").strip(),
            request.form.get("salary", "").strip(), request.form.get("skills", "").strip(),
            request.form.get("description", "").strip(), request.form.get("apply_url", "").strip(),
            request.form.get("status", "Saved"), datetime.now().strftime("%Y-%m-%d %H:%M")
        )
        with get_db() as conn:
            conn.execute("""INSERT INTO jobs
                (title, company, location, job_type, experience, salary, skills,
                 description, apply_url, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", values)
            conn.commit()
        flash("Job saved successfully. It is now available on your dashboard.", "success")
        return redirect(url_for("dashboard"))
    return render_template("add_job.html", form={})

@app.post("/job/<int:job_id>/status")
def update_status(job_id):
    new_status = request.form.get("status", "Saved")
    if new_status not in ["Saved", "Applied", "Interview", "Rejected", "Offer"]:
        new_status = "Saved"
    with get_db() as conn:
        conn.execute("UPDATE jobs SET status=? WHERE id=?", (new_status, job_id))
        conn.commit()
    flash("Application status updated.", "success")
    return redirect(url_for("dashboard"))

@app.post("/job/<int:job_id>/delete")
def delete_job(job_id):
    with get_db() as conn:
        conn.execute("DELETE FROM jobs WHERE id=?", (job_id,))
        conn.commit()
    flash("Job deleted.", "success")
    return redirect(url_for("dashboard"))

if __name__ == "__main__":
    init_db()
    print("\\nJobPilot is running:")
    print("Dashboard: http://localhost:4000/dashboard")
    print("Add Job:   http://localhost:4000/add-job\\n")
    app.run(host="127.0.0.1", port=4000, debug=True)
