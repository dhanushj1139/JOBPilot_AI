"""Job portal connectors. Each returns list of dicts: source,title,company,location,description,url,posted.
Public APIs are used by default. Portals that need login (LinkedIn/Naukri/Indeed) are provided as a Playwright
stub because they forbid scraping in their ToS and use captchas - see README."""
import os, re, requests, hashlib
H = {"User-Agent": "Mozilla/5.0 JobHunterAI"}
def clean(t): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t or "")).strip()

def remotive(query, **_):
    r = requests.get("https://remotive.com/api/remote-jobs", params={"search": query}, headers=H, timeout=20).json()
    return [dict(source="Remotive", title=j["title"], company=j["company_name"], location=j.get("candidate_required_location", "Remote"),
            description=clean(j["description"]), url=j["url"], posted=j.get("publication_date", "")) for j in r.get("jobs", [])]

def arbeitnow(query, **_):
    r = requests.get("https://www.arbeitnow.com/api/job-board-api", headers=H, timeout=20).json()
    qs = set(query.lower().split())
    return [dict(source="Arbeitnow", title=j["title"], company=j["company_name"], location=j.get("location", ""),
            description=clean(j["description"]), url=j["url"], posted=str(j.get("created_at", "")))
            for j in r.get("data", []) if not qs or qs & set((j["title"] + " " + " ".join(j.get("tags", []))).lower().split())]

def remoteok(query, **_):
    r = requests.get("https://remoteok.com/api", headers=H, timeout=20).json()[1:]
    qs = set(query.lower().split())
    return [dict(source="RemoteOK", title=j.get("position", ""), company=j.get("company", ""), location=j.get("location") or "Remote",
            description=clean(j.get("description", "")), url=j.get("url", ""), posted=j.get("date", ""))
            for j in r if not qs or qs & set((j.get("position", "") + " " + " ".join(j.get("tags", []))).lower().split())]

def adzuna(query, location="", **_):
    aid, key = os.getenv("ADZUNA_APP_ID"), os.getenv("ADZUNA_APP_KEY")
    if not aid: return []
    c = os.getenv("ADZUNA_COUNTRY", "in")
    r = requests.get(f"https://api.adzuna.com/v1/api/jobs/{c}/search/1", timeout=20,
        params=dict(app_id=aid, app_key=key, what=query, where=location, results_per_page=50)).json()
    return [dict(source="Adzuna", title=j["title"], company=j.get("company", {}).get("display_name", ""),
            location=j.get("location", {}).get("display_name", ""), description=clean(j.get("description", "")),
            url=j["redirect_url"], posted=j.get("created", "")) for j in r.get("results", [])]

def logged_in_portal(portal, username, password, query, location="", **_):
    """STUB for portals that need the user's own login (naukri, linkedin, indeed...).
    Implement with Playwright: pip install playwright && playwright install chromium
    Log in with username/password, search `query`, read the result cards, return dicts in the same shape."""
    print(f"[{portal}] login-based scraping not implemented yet (see connectors.py)")
    return []

PUBLIC = [remotive, arbeitnow, remoteok, adzuna]
def job_id(j): return hashlib.sha1((j["source"] + j["url"]).encode()).hexdigest()[:16]

from datetime import datetime, timezone
def parse_posted(v):
    """Any date format -> epoch seconds (or None)."""
    if v in (None, ""): return None
    try:
        f = float(v)
        return f / 1000 if f > 1e12 else f
    except (TypeError, ValueError): pass
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if d.tzinfo is None: d = d.replace(tzinfo=timezone.utc)
        return d.timestamp()
    except ValueError: return None
