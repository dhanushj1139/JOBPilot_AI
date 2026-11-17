// First-time setup: creates backend/.env with fresh random keys. Safe to re-run (never overwrites).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const env = path.join(__dirname, '..', '.env'), ex = path.join(__dirname, '..', '.env.example');
if (fs.existsSync(env) && /ENC_KEY=[0-9a-f]{64}/i.test(fs.readFileSync(env, 'utf8'))) { console.log('.env already set up.'); process.exit(0); }
let t = fs.readFileSync(ex, 'utf8');
const set = (k, v) => { t = new RegExp('^' + k + '=.*', 'm').test(t) ? t.replace(new RegExp('^' + k + '=.*', 'm'), k + '=' + v) : t + '\n' + k + '=' + v; };
set('JWT_SECRET', crypto.randomBytes(24).toString('hex'));
set('ENC_KEY', crypto.randomBytes(32).toString('hex'));
set('FRONTEND_ORIGIN', 'http://localhost:4000');
set('FETCH_CRON', '0 */3 * * *');
fs.writeFileSync(env, t);
console.log('Created backend/.env. Add your ADZUNA_ / JOOBLE_ keys to it, then run start.bat');
