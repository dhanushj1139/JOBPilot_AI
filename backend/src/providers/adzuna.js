const CC = { India: 'in', 'United States': 'us', 'United Kingdom': 'gb', Germany: 'de', Canada: 'ca', Australia: 'au', France: 'fr' };
module.exports = {
  name: 'adzuna',
  canApply: false, // aggregator: user finishes on the employer page via job.url
  enabled: () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  async search({ skills, titles, country, city }) {
    const cc = CC[country]; if (!cc) return [];
    const what = [...titles.slice(0, 2), ...skills.slice(0, 4)].join(' '); // matched as ANY word (what_or)
    const u = new URL(`https://api.adzuna.com/v1/api/jobs/${cc}/search/1`);
    u.search = new URLSearchParams({ app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY,
      results_per_page: '50', max_days_old: '1', sort_by: 'date', what_or: what, ...(city ? { where: city } : {}) });
    const r = await fetch(u); if (!r.ok) throw new Error('adzuna ' + r.status);
    return ((await r.json()).results || []).map((j) => ({
      provider: 'adzuna', ext_id: String(j.id), title: j.title.replace(/<\/?[^>]+>/g, ''),
      company: j.company?.display_name || '', country, city: j.location?.area?.[2] || j.location?.area?.slice(-1)[0] || '',
      description: (j.description || '').replace(/<\/?[^>]+>/g, ''), url: j.redirect_url, posted_at: Date.parse(j.created) }));
  },
};
