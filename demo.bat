@echo off
cd /d "%~dp0backend"
call npm install
node scripts/setup.js
set "DEMO_MODE=1"
set "FETCH_CRON=* * * * *"
set "DB_FILE=./demo.db"
start "" cmd /c "timeout /t 3 >nul & start http://localhost:4000"
npm start
pause
