const cron = require('node-cron');
const db = require('./db');
const providers = require('./providers');
const { blended } = require('./ats');
const { push } = require('./notify');

const DAY = 864e5;
const upsertJob = db.prepare(`INSERT INTO jobs(provider,ext_id,title,company,country,city,description,url,posted_at)
  VALUES(@provider,@ext_id,@title,@company,@country,@city,@description,@url,@posted_at)
  ON CONFLICT(provider,ext_id) DO UPDATE SET title=excluded.title RETURNING id`);
const insertMatch = db.prepare('INSERT OR IGNORE INTO matches(user_id,job_id,score,status,created_at) VALUES(?,?,?,?,?)');

async function runForUser(profile) {
  const skills = JSON.parse(profile.skills || '[]'), titles = JSON.parse(profile.titles || '[]');
  if (!skills.length && !titles.length) return 0;
  let added = 0;
  for (const p of providers.all()) {
    let jobs = [];
    try { jobs = await p.search({ skills, titles, country: profile.country, city: profile.city }); }
    catch (e) { console.warn(`[${p.name}] ${e.message}`); continue; }
    for (const j of jobs) {
      if (!j.posted_at || Date.now() - j.posted_at > 30 * DAY) continue; // last 24h only
      const id = upsertJob.get(j).id;
      const s = await blended(profile, j);
      const auto = profile.auto_apply && profile.consent_at && s >= profile.threshold;
      const res = insertMatch.run(profile.user_id, id, s, 'review', Date.now());
      if (!res.changes) continue; // already known: no duplicate alert
      added++;
      push(profile.user_id, 'new_job', { id, title: j.title, company: j.company, city: j.city, score: s, url: j.url });
      if (auto) await applyJob(profile.user_id, id).catch((e) => console.warn('auto-apply:', e.message));
    }
  }
  return added;
}

// Apply through the provider only when it truly supports it; otherwise queue for one-click manual apply.
async function applyJob(uid, jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
  const provider = providers.get(job.provider);
  if (provider?.canApply && provider.enabled()) {
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(uid);
    await provider.apply({ uid, job, profile });
    db.prepare("UPDATE matches SET status='applied',applied_at=? WHERE user_id=? AND job_id=?").run(Date.now(), uid, jobId);
    push(uid, 'applied', { id: jobId, title: job.title });
    return 'applied';
  }
  db.prepare("UPDATE matches SET status='ready_to_apply',note='Open the link to submit on the employer site' WHERE user_id=? AND job_id=?").run(uid, jobId);
  push(uid, 'ready_to_apply', { id: jobId, title: job.title, url: job.url });
  return 'ready_to_apply';
}

const runAll = async () => {
  for (const p of db.prepare('SELECT * FROM profiles').all()) await runForUser(p).catch((e) => console.warn(e.message));
};
exports.start = () => cron.schedule(process.env.FETCH_CRON || '*/15 * * * *', runAll);
exports.runForUser = runForUser;
exports.applyJob = applyJob;
