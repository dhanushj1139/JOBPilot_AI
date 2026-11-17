#!/bin/sh
cd "$(dirname "$0")/backend" && (sleep 3; (xdg-open http://localhost:4000 || open http://localhost:4000) >/dev/null 2>&1 &) & npm start
