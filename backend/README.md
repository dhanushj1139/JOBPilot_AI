# JobPilot backend

Node 18+, Express, SQLite. Pairs with the JobPilot frontend.

## Run
    npm install
    cp .env.example .env     # fill JWT_SECRET, ENC_KEY, provider keys, ANTHROPIC_API_KEY
    npm start

## API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Page 1. Returns `{token}` |
| GET | /api/portals | Page 2. Providers and connection state |
| POST/DELETE | /api/portals/:name | Save or remove an encrypted token |
| POST | /api/resume (multipart `file`) | Parse PDF/DOCX/TXT, RAG + LLM skill extraction |
| POST | /api/resume/text `{text}` | Same, from pasted text |
| GET/PUT | /api/profile | Skills, titles, country, city, auto_apply + consent, threshold |
| GET | /api/jobs?country=&source=&minScore= | Page 3. Last 24h, preferred city first, newest first |
| POST | /api/jobs/:id/apply | Manual apply or queue |
| GET | /api/notifications/stream?token= | SSE alerts: new_job, applied, ready_to_apply |
| POST | /api/refresh | Fetch now |

Frontend alerts: `new EventSource(API + '/api/notifications/stream?token=' + jwt)`.

## Pipeline (every 15 min, plus once when preferences are saved)
fetch from each enabled provider -> keep jobs posted in the last 24h -> ATS score per user ->
new match triggers an SSE alert -> if auto_apply + consent + score >= threshold, apply.

## Honest limits
- Adzuna and Jooble are legitimate job-data APIs, so they work today. They send users to the employer page, so an "auto-apply" there becomes `ready_to_apply` with a link.
- LinkedIn, Naukri, Indeed, Glassdoor and Foundit have no public search or apply API. Their adapters stay off until you hold a partner agreement and fill in the token. Do not bypass this with logins or scraping: it breaks their terms and gets user accounts banned.
- Passwords are never stored. Only OAuth/API tokens are accepted, encrypted with AES-256-GCM.
- Production: put it behind HTTPS, move to Postgres, and run the fetch job in a worker queue.
