const API = window.API_BASE ?? `${location.protocol}//${location.hostname}:4000`; // '' = same server
const GEO = {India:['Hyderabad','Bengaluru','Pune','Chennai','Mumbai'],'United States':['New York','Austin','San Francisco','Seattle'],'United Kingdom':['London','Manchester'],Germany:['Berlin','Munich'],Canada:['Toronto','Vancouver'],Australia:['Sydney','Melbourne'],France:['Paris']};
const $ = (id) => document.getElementById(id);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
let token = sessionStorage.getItem('jp_token') || '', es = null, unread = 0, notes = [], profile = null, account = null, since = Number(sessionStorage.getItem('jp_since')) || 0;

// Theme preference (saved on this device)
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  const btn = $('themeToggle');
  if (btn) { btn.innerHTML = dark ? '☀ <span>Light mode</span>' : '☾ <span>Dark mode</span>'; btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#1d241a' : '#fbfbf3';
}
applyTheme(localStorage.getItem('jp_theme') || 'light');
if ($('themeToggle')) $('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('jp_theme', next); applyTheme(next);
});

async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const r = await fetch(API + path, { method: opts.method || 'GET',
    headers: { ...(opts.body && !isForm ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: opts.body && !isForm ? JSON.stringify(opts.body) : opts.body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && token) logout(); throw new Error(j.error || 'Request failed'); }
  return j;
}
const show = (p) => ['p1', 'p2', 'p3'].forEach((x) => $(x).classList.toggle('hide', x !== p));
const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.remove('hide'); setTimeout(() => t.classList.add('hide'), 3000); };
function logout() { token = ''; since = 0; account = null; sessionStorage.removeItem('jp_token'); sessionStorage.removeItem('jp_since'); if (es) es.close(); $('profileMenu')?.classList.add('hide'); show('p1'); }

// ---- Page 1
async function auth(kind) {
  $('e1').textContent = '';
  try {
    const r = await api('/api/auth/' + kind, { method: 'POST', body: { email: $('em').value, password: $('pw').value } });
    token = r.token; sessionStorage.setItem('jp_token', token); await afterLogin();
  } catch (e) { $('e1').textContent = e.message; }
}
$('login').onclick = () => auth('login'); $('register').onclick = () => auth('register');
$('logout1').onclick = $('logout2').onclick = logout;
if ($('backWorkspace')) $('backWorkspace').onclick = () => openDash();
function updateProfileMenu() {
  const email = account?.email || 'Account';
  const display = email.includes('@') ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'My profile';
  const initials = display.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'JP';
  ['profileName', 'menuName'].forEach(id => { if ($(id)) $(id).textContent = display; });
  ['profileEmail', 'menuEmail'].forEach(id => { if ($(id)) $(id).textContent = email; });
  ['profileAvatar', 'menuAvatar'].forEach(id => { if ($(id)) $(id).textContent = initials; });
}
async function afterLogin() {
  [profile, account] = await Promise.all([api('/api/profile'), api('/api/me')]);
  updateProfileMenu();
  JSON.parse(profile.skills || '[]').length && profile.city ? openDash() : openSetup();
}

// ---- Page 2
Object.keys(GEO).forEach((c) => $('co').add(new Option(c, c)));
$('co').onchange = () => { $('cities').innerHTML = (GEO[$('co').value] || []).map((c) => `<option value="${esc(c)}">`).join(''); };
async function openSetup() {
  show('p2'); profile = await api('/api/profile');
  $('rs').value = profile.resume_text || ''; $('sk').value = JSON.parse(profile.skills || '[]').join(', ');
  $('rl').value = JSON.parse(profile.titles || '[]').join(', '); $('co').value = profile.country; $('co').onchange();
  $('lc').value = profile.city || ''; $('aa').checked = !!profile.auto_apply; $('th').value = profile.threshold || 75;
  const ps = await api('/api/portals'); const box = $('portals'); box.innerHTML = '';
  ps.forEach((p) => {
    const partner = ['linkedin', 'naukri', 'indeed'].includes(p.name), d = document.createElement('div');
    d.className = 'portal' + (p.enabled ? ' on' : '');
    d.innerHTML = `<b>${esc(p.name)}</b><span class="meta">${p.enabled ? 'Active on server' : partner ? 'Needs partner agreement' : 'Needs server API key'}</span>` +
      (p.enabled && partner ? `<span><input placeholder="Partner OAuth or API token" type="password"><button class="sec">${p.connected ? 'Update' : 'Connect'}</button></span>` : '');
    const b = d.querySelector('button');
    if (b) b.onclick = async () => { try { await api('/api/portals/' + p.name, { method: 'POST', body: { token: d.querySelector('input').value } }); toast('Saved'); } catch (e) { toast(e.message); } };
    box.appendChild(d);
  });
}
function showSkills(r) {
  $('xr').innerHTML = Object.entries(r.skills).filter(([, a]) => a.length).map(([g, a]) =>
    `<div class="grp"><b>${esc(g)}</b><div>${a.map((s) => `<span class="tag ok">${esc(s)}</span>`).join('')}</div></div>`).join('');
  const tech = Object.entries(r.skills).filter(([g]) => !/soft|cert/i.test(g)).flatMap(([, a]) => a);
  $('sk').value = tech.join(', '); if (r.titles?.length && !$('rl').value) $('rl').value = r.titles.join(', ');
  $('xs').textContent = `${tech.length} skills found (${r.method === 'llm' ? 'AI' : 'keyword scan'}). You can edit the list.`;
}
async function extract(promise) {
  $('xs').textContent = 'Reading your resume...';
  try { const r = await promise(); if (r.text) $('rs').value = r.text; showSkills(r); } catch (e) { $('xs').textContent = e.message; }
}
$('rf').onchange = () => { const f = $('rf').files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); extract(() => api('/api/resume', { method: 'POST', body: fd })); };
$('ex').onclick = () => extract(() => api('/api/resume/text', { method: 'POST', body: { text: $('rs').value } }));
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
$('save').onclick = async () => {
  $('e2').textContent = '';
  try {
    await api('/api/profile', { method: 'PUT', body: { skills: list($('sk').value), titles: list($('rl').value), country: $('co').value,
      city: $('lc').value.trim(), auto_apply: $('aa').checked, consent: $('aa').checked, threshold: Number($('th').value) || 75 } });
    openDash();
  } catch (e) { $('e2').textContent = e.message; }
};
$('edit').onclick = () => { if (es) es.close(); openSetup(); };
const profileButton = $('profileButton'), profileMenu = $('profileMenu');
if (profileButton && profileMenu) {
  profileButton.addEventListener('click', (event) => { event.stopPropagation(); const open = profileMenu.classList.toggle('hide') === false; profileButton.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', (event) => { if (!event.target.closest('.profile-menu-wrap')) { profileMenu.classList.add('hide'); profileButton.setAttribute('aria-expanded', 'false'); } });
  profileMenu.querySelectorAll('[data-profile-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.profileAction; profileMenu.classList.add('hide'); profileButton.setAttribute('aria-expanded', 'false');
    if (action === 'profile') openSetup(); else if (action === 'logout') logout(); else setWorkspacePage(action);
  }));
}


// ---- Page 3
async function openDash() {
  show('p3'); setWorkspacePage('dashboard'); [profile, account] = await Promise.all([api('/api/profile'), api('/api/me')]); updateProfileMenu(); unread = 0; $('cnt').classList.add('hide'); if ($('navCnt')) $('navCnt').classList.add('hide');
  if (!since) { since = Date.now(); sessionStorage.setItem('jp_since', since); }
  $('fc').innerHTML = Object.keys(GEO).map((c) => `<option ${c === profile.country ? 'selected' : ''}>${esc(c)}</option>`).join('');
  $('fs').innerHTML =
  '<option value="">All portals</option>' +
  [
    'demo',
    'adzuna',
    'jooble',
    'jsearch',
    'linkedin',
    'naukri',
    'indeed',
    'glassdoor'
  ].map((s) => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('');
  ['fc', 'fs', 'fm'].forEach((i) => ($(i).onchange = load)); await load(); connect();
}
const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ago'; };
const safeUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '#');
async function load() {
  const q = new URLSearchParams({ country: $('fc').value, source: $('fs').value, minScore: $('fm').value });
  const jobs = await api('/api/jobs?' + q);
  $('sum').textContent = `${jobs.length} jobs. ${profile.city || 'Preferred city'} listings first, then newest to oldest.` + (profile.auto_apply ? ` Auto-apply on at ${profile.threshold}+.` : ' Auto-apply off.');
  $('list').innerHTML = jobs.map((j) => {
    const st = j.status === 'applied' ? '<span class="tag ok">Applied</span>' : j.status === 'ready_to_apply' ? `<a class="tag ok" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener">Ready: finish on employer site</a>` : `<button class="sec" data-a="${j.id}">Apply</button>`;
    return `<div class="card job"><div class="sc ${j.score < 75 ? 'lo' : ''}">${j.score}<small>ATS</small></div><div class="b"><b>${esc(j.title)}</b> at ${esc(j.company)}
      <div class="meta">${esc(j.city)}, ${esc(j.country)} · ${ago(j.posted_at)} · via ${esc(j.source)}</div>${j.preferred ? '<span class="tag ok">Preferred location</span>' : ''}
      <div>${st} <a href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener">View posting</a></div></div></div>`;
  }).join('') || '<div class="panel meta">No jobs yet. Connect a job source or refresh to look for opportunities.</div>';
  renderWorkspaceData(jobs);
  $('list').querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => { try { const r = await api(`/api/jobs/${b.dataset.a}/apply`, { method: 'POST' }); toast(r.status); load(); } catch (e) { toast(e.message); } }));
}

function renderWorkspaceData(jobs) {
  const applied = jobs.filter(j => j.status === 'applied');
  const ready = jobs.filter(j => j.status === 'ready_to_apply');
  const review = jobs.filter(j => !['applied','ready_to_apply'].includes(j.status));
  const strong = jobs.filter(j => Number(j.score) >= 75);
  $('statJobs').textContent = jobs.length;
  $('statApplied').textContent = applied.length;
  $('statReady').textContent = ready.length;
  $('statStrong').textContent = strong.length;
  $('appApplied').textContent = applied.length;
  $('appReady').textContent = ready.length;
  $('appReview').textContent = review.length;
  const recent = [...jobs].sort((a,b) => Number(b.posted_at || 0) - Number(a.posted_at || 0)).slice(0,5);
  $('recentJobs').innerHTML = recent.length ? recent.map(j => `
    <div class="recent-row"><div class="company-mark">${esc((j.company || 'J').slice(0,1).toUpperCase())}</div>
      <div class="recent-info"><b>${esc(j.title)}</b><small>${esc(j.company)} · ${esc(j.city || j.country || '')}</small></div>
      <span class="recent-score">${Number(j.score) || 0}%</span></div>`).join('') : '<p class="meta">No opportunities yet. Visit Find jobs and refresh your feed.</p>';
  const tracked = [...applied, ...ready, ...review].sort((a,b) => Number(b.posted_at || 0) - Number(a.posted_at || 0));
  $('applicationsList').innerHTML = tracked.length ? tracked.map(j => {
    const label = j.status === 'applied' ? 'Applied' : j.status === 'ready_to_apply' ? 'Ready to apply' : 'To review';
    const cls = j.status === 'applied' ? 'ok' : '';
    const action = j.status === 'applied' ? '' : j.status === 'ready_to_apply'
      ? `<a class="tag ok" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener">Continue on employer site ↗</a>`
      : `<button class="secondary" data-track="${j.id}">Mark applied</button>`;
    return `<div class="application-row"><div class="company-mark">${esc((j.company || 'J').slice(0,1).toUpperCase())}</div><div class="recent-info"><b>${esc(j.title)}</b><small>${esc(j.company)} · ${esc(j.city || '')}</small></div><span class="tag ${cls}">${label}</span>${action}</div>`;
  }).join('') : '<p class="meta">Your application tracker is empty. When you apply to or mark a job, it will appear here.</p>';
  $('applicationsList').querySelectorAll('[data-track]').forEach(b => b.onclick = async () => {
    try { const r = await api(`/api/jobs/${b.dataset.track}/apply`, {method:'POST'}); toast(r.status || 'Application updated'); await load(); }
    catch(e) { toast(e.message); }
  });
}
function setWorkspacePage(page) {
  const names = {dashboard:'Overview',jobs:'Find jobs',applications:'My applications',alerts:'Notifications'};
  document.querySelectorAll('.page-view').forEach(el => el.classList.toggle('hide', el.id !== 'page-' + page));
  document.querySelectorAll('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('pageCrumb').textContent = names[page] || 'Overview';
  if (page === 'alerts') openAlerts();
}
document.querySelectorAll('.nav-item[data-page]').forEach(b => b.addEventListener('click', () => setWorkspacePage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setWorkspacePage(b.dataset.go)));
$('refreshJobs').onclick = async () => { $('refreshJobs').disabled = true; try { const r = await api('/api/refresh',{method:'POST'}); toast((r.added || 0)+' new jobs'); await load(); } catch(e){toast(e.message);} $('refreshJobs').disabled = false; };

function connect() {
  if (es) es.close(); es = new EventSource(`${API}/api/notifications/stream?token=${encodeURIComponent(token)}`);
  es.addEventListener('new_job', (e) => {
    const j = JSON.parse(e.data); unread++; $('cnt').textContent = unread; $('cnt').classList.remove('hide'); if ($('navCnt')) { $('navCnt').textContent = unread; $('navCnt').classList.remove('hide'); } $('bell').classList.add('pulse'); if (!$('np').classList.contains('hide')) renderAlerts();
    toast(`New job: ${j.title} (${j.score})`); try { if (Notification.permission === 'granted') new Notification('New job: ' + j.title, { body: j.company + ', ' + j.city }); } catch {}
    clearTimeout(connect.t); connect.t = setTimeout(load, 1500);
  });
  es.addEventListener('applied', load); es.addEventListener('ready_to_apply', load);
  try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
}
const STATUS = { applied: 'Applied', ready_to_apply: 'Ready to apply', review: 'To review' };
async function renderAlerts() {
  const list = await api('/api/alerts?since=' + since);
  $('np').innerHTML = '<b>Alerts</b>' + (list.length ? list.map((a) => `<div class="alert"><b>New job: ${esc(a.title)}</b>
    <span class="tag ok">ATS ${a.score}</span><span class="tag ${a.status === 'applied' ? 'ok' : ''}">${STATUS[a.status] || a.status}</span>
    <div class="meta">${esc(a.company)}, ${esc(a.city)} · ${ago(a.created_at)}</div></div>`).join('') : '<p class="meta">No new jobs since you opened the dashboard. New and manually added jobs appear here.</p>');
}
async function openAlerts() { $('np').classList.remove('hide'); unread = 0; $('cnt').classList.add('hide'); if ($('navCnt')) $('navCnt').classList.add('hide'); $('bell').classList.remove('pulse'); await renderAlerts(); }
if ($('bell')) $('bell').onclick = () => setWorkspacePage('alerts');
$('refresh').onclick = async () => { $('refresh').disabled = true; try { const r = await api('/api/refresh', { method: 'POST' }); toast(r.added + ' new jobs'); await load(); } catch (e) { toast(e.message); } $('refresh').disabled = false; };
if (token) afterLogin().catch(() => logout());

fetch(API + '/api/demo').then((r) => r.json()).then((d) => {
  if (!d.demo) return;
  $('demoNote').classList.remove('hide'); $('demo').classList.remove('hide'); $('addjob').classList.remove('hide');
  $('demo').onclick = () => { $('em').value = d.email; $('pw').value = d.password; auth('login'); };
}).catch(() => {});

$('aj').onclick = async () => {
  try {
    const r = await api('/api/demo/job', { method: 'POST', body: { title: $('jt').value, company: $('jc').value, city: $('jl').value, skills: $('js').value } });
    toast('Job added. ATS score ' + r.score); ['jt', 'jc', 'jl', 'js'].forEach((i) => ($(i).value = '')); await load(); await openAlerts();
  } catch (e) { toast(e.message); }
};
