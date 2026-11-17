@echo off
cd /d "%~dp0backend"
call npm install
node scripts/setup.js
echo.
echo Setup done. Edit backend\.env to add job-source keys, then double-click start.bat
pause
