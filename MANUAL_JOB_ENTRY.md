# JobPilot — Manual Job Entry Update

This version adds a **+ Add Job** form to the signed-in dashboard.

## Add a job
1. Sign in to JobPilot and complete your profile/resume setup.
2. On the dashboard, select **+ Add Job**.
3. Enter the job title, company, city, country, description/skills, and application URL.
4. Optionally enter the original posting date.
5. Select **Save job**.

The backend saves the job in SQLite with source `manual`, calculates a resume match score using the existing ATS matching module, and associates the job with the signed-in account. Manual jobs remain visible even when their original posting date is more than 24 hours old. They are not automatically applied to; use **View posting** to continue on the employer's website.

## Run on Windows
1. Extract this ZIP.
2. Open the extracted `jobpilot` folder in VS Code.
3. Open a terminal and run:
   ```bat
   cd backend
   copy .env.example .env
   ```
   If your project has no `.env.example`, create `backend/.env` using the required values in `backend/README.md` (at minimum `JWT_SECRET` and `ENC_KEY`).
4. Install dependencies and start:
   ```bat
   npm install
   npm start
   ```
5. Open `http://localhost:4000`.

Use Node.js 18 or newer. Keep your `.env` private and do not share API keys or encryption secrets.
