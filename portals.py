"""Logged-in portal search (Naukri, LinkedIn) using a real browser (Playwright).
Flow: Connect (visible browser, you handle OTP/captcha once) -> session saved -> later searches run headless inside your account.
Selectors are best-effort: these sites change their HTML often. If 0 jobs come back, see data/debug_<portal>.png."""
import os, re, time, random, threading
from urllib.parse import quote_plus
SESS = "data/sessions"; os.makedirs(SESS, exist_ok=True)
STATUS = {}                      # (user_id, portal) -> message
_lock = threading.Lock()
NAMES = {"naukri": "Naukri", "linkedin": "LinkedIn"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
LOGIN = {  # url, user field, password field, submit button
    "naukri": ("https://www.naukri.com/nlogin/login", "#usernameField", "#passwordField", "button[type=submit]"),
    "linkedin": ("https://www.linkedin.com/login", "#username", "#password", "button[type=submit]"),
}
def sp(uid, portal): return f"{SESS}/{uid}_{portal}.json"
def connected(uid, portal): return os.path.exists(sp(uid, portal))
def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def pause(a=1.2, b=2.8): time.sleep(random.uniform(a, b))

def search_url(portal, query, loc):
    if portal == "naukri":
        return f"https://www.naukri.com/{slug(query)}-jobs" + (f"-in-{slug(loc)}" if loc else "")
    return (f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(query)}&location={quote_plus(loc)}"
            f"&f_TPR=r604800&sortBy=DD")

def logged_in(page, portal):
    u = page.url
    if portal == "naukri": return "naukri.com" in u and "nlogin" not in u
    return any(k in u for k in ("/feed", "/jobs", "/mynetwork")) and not any(k in u for k in ("login", "checkpoint", "authwall"))
def needs_login(page, portal):
    u = page.url
    return ("nlogin" in u) if portal == "naukri" else any(k in u for k in ("login", "authwall", "checkpoint", "signup"))

AUTH_COOKIES = {"naukri": {"nauk_at"}, "linkedin": {"li_at"}}
DIAG = {}
def _ok(ctx, portal):
    """True = logged in, False = not yet, None = the user closed the browser window."""
    try:
        if not ctx.browser.is_connected() or not ctx.pages: return None
    except Exception: return None
    try:
        names = {c["name"] for c in ctx.cookies()}
        DIAG["cookies"] = ",".join(sorted(names))[:150]
        if names & AUTH_COOKIES[portal]: return True
    except Exception: pass                       # page is navigating - just try again later
    for pg in list(ctx.pages):
        try:
            DIAG["url"] = pg.url
            if logged_in(pg, portal): return True
            if portal == "naukri" and pg.locator("a[href*='mnjuser'], [class*='nI-gNb-drawer']").count(): return True
        except Exception: continue               # ignore errors caused by page navigation
    return False

def _login(page, ctx, portal, user, pw, wait):
    """True = logged in, None = user closed the window (keep last snapshot), False = timed out."""
    url, fu, fp, fs = LOGIN[portal]
    try:
        page.goto(url, wait_until="domcontentloaded"); pause()
        page.fill(fu, user); pause(.5, 1); page.fill(fp, pw); pause(.5, 1); page.click(fs)
    except Exception as e: print(f"[{portal}] login form step:", str(e).splitlines()[0])
    end = time.time() + wait
    while time.time() < end:
        time.sleep(2)
        r = _ok(ctx, portal)
        if r is True: pause(2.5, 3.5); return True
        if r is None: return None
        try: ctx.storage_state(path=sp(0, portal) + ".snap")
        except Exception: pass
    return False

def _launch(p, headless):
    return p.chromium.launch(headless=headless, args=["--disable-blink-features=AutomationControlled"])

def _connect(uid, portal, user, pw):
    """Opens a VISIBLE browser so you can pass OTP/captcha. Saves the session when login succeeds."""
    key = (uid, portal); STATUS[key] = "Opening browser… finish login there if asked (3 min)"
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = _launch(p, False); ctx = b.new_context(user_agent=UA); page = ctx.new_page()
            r = _login(page, ctx, portal, user, pw, 180)
            snap = sp(0, portal) + ".snap"
            if r is True:
                ctx.storage_state(path=sp(uid, portal)); STATUS[key] = ""
            elif r is None and os.path.exists(snap):          # window closed by user after logging in
                os.replace(snap, sp(uid, portal)); STATUS[key] = "Saved – will be verified on first search"
            else:
                STATUS[key] = f"Login not detected. page={DIAG.get('url','?')[:70]} cookies={DIAG.get('cookies','')[:90]}"
            if os.path.exists(snap): os.remove(snap)
            try: b.close()
            except Exception: pass
    except Exception as e:
        STATUS[key] = f"Error: {type(e).__name__}: {(str(e).splitlines() or [''])[0][:160]}"

CARDS = {
"naukri": """() => { const out=[], seen=new Set();
 document.querySelectorAll("a[href*='job-listings']").forEach(a => {
  const href=a.href.split("?")[0]; if(seen.has(href)) return; seen.add(href);
  const card=a.closest(".srp-jobtuple-wrapper,.cust-job-tuple,article,[class*=jobTuple]")||a.parentElement.parentElement.parentElement;
  const t=s=>{const e=card&&card.querySelector(s);return e?e.innerText.trim():""};
  out.push({title:(a.innerText||a.title||"").trim(), url:href, company:t("a.comp-name,.comp-name,[class*=comp-name]"),
   location:t(".locWdth,.loc,[class*=locWdth],[class*=location]"), desc:t(".job-desc,[class*=job-desc]"),
   posted:t(".job-post-day,[class*=post-day]"), text:card?card.innerText:""}); });
 return out; }""",
"linkedin": """() => { const out=[], seen=new Set();
 document.querySelectorAll("a[href*='/jobs/view/']").forEach(a => {
  const m=a.href.match(/\\/jobs\\/view\\/(?:[^\\/?]*?-)?(\\d{6,})/); if(!m||seen.has(m[1])) return; seen.add(m[1]);
  const card=a.closest("li,.job-card-container,[data-job-id]")||a.parentElement.parentElement;
  const t=s=>{const e=card&&card.querySelector(s);return e?e.innerText.trim().split("\\n")[0]:""};
  const tm=card&&card.querySelector("time");
  out.push({title:(a.getAttribute("aria-label")||a.innerText||"").trim().split("\\n")[0],
   url:"https://www.linkedin.com/jobs/view/"+m[1]+"/",
   company:t(".artdeco-entity-lockup__subtitle,.job-card-container__primary-description,[class*=subtitle]"),
   location:t(".artdeco-entity-lockup__caption,.job-card-container__metadata-item,[class*=caption]"),
   posted:tm?(tm.getAttribute("datetime")||tm.innerText):"", desc:"", text:card?card.innerText:""}); });
 return out; }""",
}
DETAIL = """() => { for (const s of ["#job-details",".jobs-description__content",".jobs-box__html-content",
 "[class*=dang-inner-html]","[class*=job-desc]","section[class*=JDC]","main"]) {
  const e=document.querySelector(s); if(e && e.innerText.trim().length>80) return e.innerText.trim().slice(0,5000); }
 return document.body.innerText.slice(0,4000); }"""

def _search(uid, portal, user, pw, query, locations, known):
    """Search inside the user's logged-in account. Returns job dicts. `known` = urls already stored (skip detail fetch)."""
    from playwright.sync_api import sync_playwright
    key, out = (uid, portal), []
    with sync_playwright() as p:
        b = _launch(p, os.getenv("PW_HEADLESS", "true").lower() != "false")
        ctx = b.new_context(user_agent=UA, storage_state=sp(uid, portal) if connected(uid, portal) else None)
        page = ctx.new_page(); details = 0
        try:
            if not connected(uid, portal):
                if _login(page, ctx, portal, user, pw, 40) is True: ctx.storage_state(path=sp(uid, portal))
                else: STATUS[key] = "Login failed – click Connect"; return []
            for loc in (locations or [""])[:3]:
                url = search_url(portal, query, loc)
                page.goto(url, wait_until="domcontentloaded"); pause(2.5, 4)
                if needs_login(page, portal):
                    if _login(page, ctx, portal, user, pw, 40) is not True:
                        STATUS[key] = "Session expired – click Connect"
                        if os.path.exists(sp(uid, portal)): os.remove(sp(uid, portal))
                        break
                    ctx.storage_state(path=sp(uid, portal)); page.goto(url, wait_until="domcontentloaded"); pause(2.5, 4)
                page.mouse.move(300, 500)
                for _ in range(4): page.mouse.wheel(0, 2500); pause(.8, 1.5)
                cards = [c for c in page.evaluate(CARDS[portal]) if c["title"]]
                if not cards: page.screenshot(path=f"data/debug_{portal}.png"); print(f"[{portal}] 0 cards, see data/debug_{portal}.png")
                for c in cards[:40]:
                    desc = c.get("desc") or ""
                    if c["url"] not in known and details < 12:
                        try:
                            page.goto(c["url"], wait_until="domcontentloaded"); pause(1.5, 3)
                            desc = page.evaluate(DETAIL); details += 1
                        except Exception as e: print("detail failed", e)
                    out.append(dict(source=NAMES[portal], title=re.sub(r" with verification$", "", c["title"], flags=re.I),
                        company=c["company"], location=c["location"] or loc, description=desc or c.get("text", ""),
                        url=c["url"], posted=c.get("posted", "")))
            STATUS[key] = ""
        finally:
            try: ctx.storage_state(path=sp(uid, portal)) if connected(uid, portal) else None
            except Exception: pass
            b.close()
    return out


# ---- run the browser in a separate process (Playwright cannot start browsers inside uvicorn on Windows) ----
def _run(req, timeout):
    import subprocess, sys, json, tempfile
    fd, rp = tempfile.mkstemp(suffix=".json"); os.close(fd)
    req["out"] = rp + ".out"; json.dump(req, open(rp, "w"))
    try:
        r = subprocess.run([sys.executable, os.path.abspath(__file__), rp], capture_output=True, text=True, timeout=timeout)
        if r.stdout.strip(): print(r.stdout.strip()[-800:])
        if os.path.exists(req["out"]): return json.load(open(req["out"]))
        err = (r.stderr.strip().splitlines() or ["worker crashed"])[-1]
        print(r.stderr[-1500:]); return {"status": f"Error: {err[:160]}", "jobs": []}
    except subprocess.TimeoutExpired: return {"status": "Error: timed out", "jobs": []}
    finally:
        for f in (rp, req["out"]):
            if os.path.exists(f): os.remove(f)

def connect(uid, portal, user, pw):
    STATUS[(uid, portal)] = "Opening browser… finish login there if asked (3 min)"
    res = _run(dict(op="connect", uid=uid, portal=portal, user=user, pw=pw), 300)
    STATUS[(uid, portal)] = res.get("status", "")

def search(uid, portal, user, pw, query, locations, known):
    with _lock:
        res = _run(dict(op="search", uid=uid, portal=portal, user=user, pw=pw, query=query,
                        locations=locations, known=list(known)), 900)
    STATUS[(uid, portal)] = res.get("status", "")
    return res.get("jobs", [])

if __name__ == "__main__":
    import sys, json, asyncio
    if sys.platform == "win32": asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    req = json.load(open(sys.argv[1])); key = (req["uid"], req["portal"]); res = {"jobs": []}
    try:
        if req["op"] == "connect": _connect(req["uid"], req["portal"], req["user"], req["pw"])
        else: res["jobs"] = _search(req["uid"], req["portal"], req["user"], req["pw"], req["query"], req["locations"], set(req["known"]))
        res["status"] = STATUS.get(key, "")
    except Exception as e:
        res["status"] = f"Error: {type(e).__name__}: {(str(e).splitlines() or [''])[0][:160]}"
    json.dump(res, open(req["out"], "w"))