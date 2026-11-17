# JobPilot – AI-Powered Job Search & Resume Matching Platform

JobPilot is an AI-powered job search and resume-matching platform designed to help job seekers discover relevant opportunities based on their skills, experience, resume and career preferences.

The application collects job listings from multiple providers, analyzes resumes, calculates ATS-style matching scores and displays relevant opportunities through an interactive dashboard.

## Features

- **User Authentication:** User registration and login.
- **Resume Upload:** Upload resumes in PDF, DOCX and TXT formats.
- **Resume Parsing:** Extract skills, job titles and relevant information from resumes.
- **Job Search:** Collect job opportunities from multiple job portals.
- **ATS Matching:** Calculate compatibility scores between resumes and job descriptions.
- **Job Filtering:** Filter jobs by location, source and minimum ATS score.
- **Job Preferences:** Configure preferred skills, job titles, country and city.
- **Job Refresh:** Fetch new job listings manually or automatically.
- **Notifications:** Receive notifications about newly matched opportunities.
- **Application Management:** Track job application progress.
- **SQLite Database:** Store user profiles, jobs, preferences and matching results.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite |
| Programming | JavaScript, Python |
| Machine Learning | Scikit-learn |
| Resume Processing | PDF and DOCX parsing |
| Job APIs | Adzuna, Jooble, JSearch |
| ML Service | Python, FastAPI |
| Additional Framework | Flask |

## Project Structure

```text
JobPilot/
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── config.js
│
├── backend/
│   ├── src/
│   │   ├── providers/
│   │   │   ├── adzuna.js
│   │   │   ├── jooble.js
│   │   │   ├── jsearch.js
│   │   │   ├── demo.js
│   │   │   └── index.js
│   │   │
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── scheduler.js
│   │   ├── resume.js
│   │   ├── ats.js
│   │   └── auth.js
│   │
│   ├── scripts/
│   │   └── setup.js
│   │
│   ├── package.json
│   └── .env.example
│
├── ml-service/
│   ├── main.py
│   └── requirements.txt
│
├── app.py
├── requirements.txt
├── setup.bat
├── start.bat
├── setup.sh
├── start.sh
└── README.md
```

## Prerequisites

Before running the project, install the following:

1. **Node.js** – Version 22 or newer recommended.
2. **npm** – Installed automatically with Node.js.
3. **Python** – Version 3.10 or newer recommended.
4. **Git** – For cloning and managing the repository.
5. **VS Code** – Recommended code editor.

Verify the installations:

```bash
node --version
npm --version
python --version
git --version
```

On Windows, you can also use:

```powershell
py --version
```

---

# Installation and Setup

## 1. Clone the Repository

```bash
git clone <your-repository-url>
```

Navigate to the project directory:

```bash
cd JobPilot
```

## 2. Backend Setup – Node.js

Navigate to the backend directory:

```bash
cd backend
```

Install the required npm packages:

```bash
npm install
```

This installs all dependencies specified in `backend/package.json`.

## 3. Environment Configuration

Return to the project root:

```bash
cd ..
```

Generate the backend environment configuration:

```bash
node backend/scripts/setup.js
```

This script generates the required security secrets and creates the `backend/.env` file.

Open `backend/.env` and configure your API credentials.

Example configuration:

```env
PORT=4000

DB_FILE=./jobpilot.db

JWT_SECRET=your_generated_jwt_secret

ENC_KEY=your_generated_encryption_key

ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

JOOBLE_API_KEY=your_jooble_api_key
JOOBLE_API_BASE=https://in.jooble.org/api

JSEARCH_API_KEY=your_jsearch_api_key

FETCH_CRON=0 */6 * * *

ML_SERVICE_URL=http://localhost:8000
```

**Note:** Use your actual generated secrets and API credentials. Do not commit `.env` to GitHub.

## 4. Start the Backend Server

Navigate to the backend directory:

```bash
cd backend
```

Start the application:

```bash
npm start
```

The backend server will run at:

```text
http://localhost:4000
```

Open the URL in your browser to access JobPilot.

To stop the server:

```bash
Ctrl + C
```

---

# Python Virtual Environment Setup

Python virtual environments keep project dependencies isolated from other Python projects.

## 5. Create a Virtual Environment

From the project root directory:

### Windows

```powershell
python -m venv .venv
```

Alternatively:

```powershell
py -m venv .venv
```

### macOS / Linux

```bash
python3 -m venv .venv
```

## 6. Activate the Virtual Environment

### Windows – PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

### Windows – Command Prompt

```cmd
.venv\Scripts\activate.bat
```

### macOS / Linux

```bash
source .venv/bin/activate
```

After successful activation, the terminal displays:

```text
(.venv)
```

## 7. Upgrade pip

```bash
python -m pip install --upgrade pip
```

## 8. Install Python Dependencies

For the separate Flask application:

```bash
pip install -r requirements.txt
```

For the optional ML service:

```bash
cd ml-service
pip install -r requirements.txt
```

To deactivate the virtual environment:

```bash
deactivate
```

---

# Optional ML Service Setup

JobPilot includes a separate Python ML service for resume-to-job similarity analysis.

The main application can operate without this service, using its built-in ATS scoring fallback.

Navigate to the ML service directory:

```bash
cd ml-service
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the ML service:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

The service will be available at:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

Configure the backend `.env` file:

```env
ML_SERVICE_URL=http://localhost:8000
```

Restart the Node.js backend after updating the configuration.

---

# Running the Separate Flask Application

The repository also contains a separate Flask-based manual job tracker.

To run it:

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the Flask application:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:4000/dashboard
```

**Important:** The Flask application is separate from the main Node.js JobPilot application. Both use port 4000 by default, so do not run them simultaneously unless you change one application's port.

---

# Job Providers and API Integration

JobPilot supports multiple job-search providers.

| Provider | Integration |
|---|---|
| Adzuna | API integration |
| Jooble | API integration |
| JSearch | OpenWeb Ninja API |
| Demo | Sample job data |
| LinkedIn | Partner integration placeholder |
| Naukri | Partner integration placeholder |
| Indeed | Partner integration placeholder |

Provider availability depends on valid API credentials and access permissions.

Some integrations require approved partner access and cannot be activated simply by adding an API key.

# Demo Mode

JobPilot provides a demo mode for testing and demonstrations.

On Windows, run:

```text
demo.bat
```

On macOS/Linux:

```bash
./demo.sh
```

Demo credentials:

```text
Email: demo@jobpilot.app
Password: Demo@1234
```

Demo mode uses sample data and a separate database.

Do not use the demo account for personal information.

---

# Testing

## Backend Tests

Navigate to the backend directory:

```bash
cd backend
```

Run:

```bash
npm test
```

## ML Service Tests

Navigate to the ML service directory:

```bash
cd ml-service
```

Install development dependencies if available:

```bash
pip install -r requirements-dev.txt
```

Run:

```bash
pytest
```

---

# API Endpoints

The main backend provides the following API endpoints:

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/portals` | Retrieve job providers |
| POST | `/api/portals/:name` | Configure a provider |
| DELETE | `/api/portals/:name` | Remove a provider connection |
| POST | `/api/resume` | Upload a resume |
| POST | `/api/resume/text` | Submit resume text |
| GET | `/api/profile` | Retrieve user profile |
| PUT | `/api/profile` | Update user profile |
| GET | `/api/jobs` | Retrieve matched jobs |
| GET | `/api/alerts` | Retrieve job alerts |
| POST | `/api/jobs/:id/apply` | Start the apply workflow |
| POST | `/api/refresh` | Refresh job listings |
| GET | `/api/notifications/stream` | Receive live notifications |
| GET | `/health` | Check backend health |

Most protected API endpoints require authentication.

---

# Database

JobPilot uses SQLite for data persistence.

The database stores:

- User information.
- Authentication details.
- Resume information.
- User job preferences.
- Job listings.
- Job provider information.
- ATS matching scores.
- Application statuses.
- Job alerts and notifications.

The database is automatically initialized when the backend starts.

Keep regular backups of your database.

---

# Troubleshooting

### 1. Node.js or npm is not recognized

Install Node.js and restart your terminal.

Verify:

```bash
node --version
npm --version
```

### 2. Missing npm dependencies

Navigate to the backend directory:

```bash
cd backend
npm install
```

### 3. Missing JWT_SECRET or ENC_KEY

Run:

```bash
node backend/scripts/setup.js
```

Verify that `backend/.env` exists and contains the required secrets.

### 4. Port 4000 is already in use

Stop the other process using port 4000 or configure a different port.

### 5. No jobs are displayed

- Verify provider API credentials.
- Check the user's country and job preferences.
- Check the backend terminal for provider errors.
- Use the dashboard's refresh option.

### 6. Resume extraction issues

Check that the uploaded file is in a supported format:

- PDF
- DOCX
- TXT

Anthropic-based extraction is optional. Without an API key, the built-in keyword extraction fallback is used.

---

# Security Guidelines

- Never upload `.env` files to public repositories.
- Never expose API keys or authentication secrets.
- Use strong authentication secrets.
- Keep dependencies updated.
- Back up the SQLite database regularly.
- Use HTTPS for production deployments.
- Obtain explicit user confirmation before submitting real job applications.

---

# Future Enhancements

Potential future improvements include:

- Advanced ATS matching and skill-gap analysis.
- AI-powered resume optimization.
- Improved job filtering and duplicate detection.
- Advanced application tracking.
- Career analytics dashboard.
- Interview preparation assistant.
- Additional authorized job-provider integrations.

---

## Author

**JobPilot – AI-Powered Job Search & Resume Matching Platform**

A project focused on simplifying job discovery, resume analysis and job application management.