@echo off
cd /d "%~dp0backend"
start "" cmd /c "timeout /t 3 >nul & start http://localhost:4000"
npm start
pause
