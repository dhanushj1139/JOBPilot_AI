#!/bin/sh
cd "$(dirname "$0")/backend" && npm install && node scripts/setup.js
DEMO_MODE=1 FETCH_CRON="* * * * *" DB_FILE=./demo.db npm start
