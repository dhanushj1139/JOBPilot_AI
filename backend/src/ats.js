// ATS score 0-100: required-skill coverage (85) + title match (15). Mirrors the frontend.
const { DICT, has } = require('./resume');
exports.score = (profile, job) => {
  const skills = JSON.parse(profile.skills || '[]').map((s) => s.toLowerCase());
  const titles = JSON.parse(profile.titles || '[]').map((s) => s.toLowerCase());
  const resume = (profile.resume_text || '').toLowerCase() + ' ' + skills.join(' ');
  const jobText = (job.title + ' ' + (job.description || '')).toLowerCase();
  const req = DICT.filter((k) => has(jobText, k));
  let base;
  if (req.length) base = (req.filter((k) => has(resume, k)).length / req.length) * 85;
  else base = Math.min(1, skills.filter((s) => jobText.includes(s)).length / Math.max(1, Math.min(skills.length, 8))) * 85;
  const jt = job.title.toLowerCase();
  const tm = titles.some((t) => jt.includes(t) || t.includes(jt)) ? 15 : 0;
  return Math.min(100, Math.round(base + tm));
};

// Rule score blended with the ML service similarity (70/30). Falls back to the rule score if the service is down.
exports.blended = async (profile, job) => {
  const rule = exports.score(profile, job);
  const url = process.env.ML_SERVICE_URL;
  if (!url) return rule;
  try {
    const r = await fetch(url + '/match', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resume: profile.resume_text || '', job: job.title + ' ' + (job.description || '') }),
      signal: AbortSignal.timeout(4000) });
    if (!r.ok) return rule;
    const { similarity } = await r.json();
    return Math.round(0.7 * rule + 0.3 * similarity * 100);
  } catch { return rule; }
};
