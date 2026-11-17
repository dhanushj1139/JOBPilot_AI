#!/bin/sh
cd "$(dirname "$0")/backend" && npm install && node scripts/setup.js
