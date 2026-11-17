# JobPilot

Finds jobs from your skills, scores each one against your resume (ATS score), alerts you to new postings from the last 24 hours, and can auto-apply above a score threshold you choose.

```
jobpilot/
  frontend/     Static web app (login, setup, job dashboard, live alerts)
  backend/      Node + Express + SQLite API, scheduler, resume parsing, RAG + LLM skill extraction
  ml-service/   Python FastAPI similarity service (TF-IDF, optional sentence embeddings)
  docker-compose.yml, .env.example
```

## Quick start (Windows, no Docker)
1. Install Node.js 22 or newer (https://nodejs.org).
2. Double-click **setup.bat** (first time only). It installs packages and creates `backend/.env` with fresh keys.
3. Open `backend/.env` and add `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` or `JOOBLE_API_KEY`.
4. Double-click **start.bat**. The app opens at http://localhost:4000. Close the window to stop it.

Mac/Linux: run `./setup.sh`, then `./start.sh`.

## Demo mode (no keys, for presentations)
Double-click **demo.bat** (Mac/Linux: `./demo.sh`). It uses a separate `demo.db`, loads sample jobs, creates the account `demo@jobpilot.app` / `Demo@1234` (the **Use demo account** button signs in for you), and adds a new job every minute so alerts appear live. Applications are simulated. Use **Add a job (demo)** on the dashboard to add a job by hand during a presentation. Delete `backend/demo.db` to reset.

## Docker (optional)
    cp .env.example .env      # set JWT_SECRET, ENC_KEY and provider keys
    docker compose up --build
Open http://localhost:8080. The optional ML service runs at :8000.

The ML service is optional. To use it locally: `cd ml-service && pip install -r requirements.txt && uvicorn main:app --port 8000`, then add `ML_SERVICE_URL=http://localhost:8000` to `backend/.env`.

## How it works
1. **Login and setup:** register, upload a resume (PDF/DOCX/TXT). The backend chunks it, ranks chunks with TF-IDF, asks Claude to extract skills from the best chunks, and drops any skill not literally in the resume.
2. **Fetching:** every 15 minutes (and when you save preferences) it pulls jobs posted in the last 24 hours from each enabled provider for your country.
3. **Scoring:** ATS score = 70% rule score (required-skill coverage plus title match) + 30% ML similarity. If the ML service is down, the rule score is used.
4. **Alerts:** each new match is pushed over server-sent events and shown as a toast, a bell badge and a browser notification.
5. **Auto-apply:** needs your explicit consent and a score at or above your threshold.
6. **Sorting:** preferred city first, then newest to oldest, only inside your chosen country.

## Tests
    cd backend && npm test
    cd ml-service && pip install -r requirements-dev.txt && pytest

## Important limits
- **Working job sources:** Adzuna and Jooble (free API keys). They link to the employer page, so auto-apply there becomes "ready to apply" with a link.
- **LinkedIn, Naukri, Indeed, Glassdoor, Foundit:** no public search or apply API. Adapters in `backend/src/providers/index.js` stay off until you hold a partner agreement; fill in `search()` and `apply()` per their docs. Do not bypass this by scraping or using stored logins.
- **Passwords:** never stored. Only OAuth/API tokens, encrypted with AES-256-GCM.
- **Production:** use HTTPS, a managed Postgres instead of SQLite, a job queue for fetching, and a secrets manager.
