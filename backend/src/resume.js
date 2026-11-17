// Resume parsing + RAG skill extraction (chunk -> TF-IDF retrieve -> LLM -> grounding check)
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

exports.parseFile = async (file) => {
  const n = file.originalname.toLowerCase();
  if (n.endsWith('.pdf')) return (await pdf(file.buffer)).text;
  if (n.endsWith('.docx')) return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  if (/\.(txt|md)$/.test(n)) return file.buffer.toString('utf8');
  throw Object.assign(new Error('Use a PDF, DOCX or TXT file'), { status: 400 });
};

const toks = (t) => t.toLowerCase().match(/[a-z][a-z+#.\/]*/g) || [];
function chunkText(t) {
  const out = [];
  for (let p of t.split(/\n\s*\n/)) {
    p = p.trim();
    while (p.length > 600) { let c = p.lastIndexOf(' ', 500); if (c < 200) c = 500; out.push(p.slice(0, c)); p = p.slice(c - 80); }
    if (p) out.push(p);
  }
  return out;
}
const QUERIES = [
  'programming languages python java javascript c++ sql',
  'frameworks libraries react angular django spring node flask',
  'databases mysql postgresql mongodb oracle redis',
  'cloud devops aws azure gcp docker kubernetes git jenkins linux',
  'tools platforms jira tableau excel power bi figma',
  'certifications certified course training award',
  'soft skills leadership communication teamwork management',
  'technical skills summary experience projects'];

function retrieve(text) {
  const ch = chunkText(text);
  if (ch.length <= 8) return ch;
  const docs = ch.map(toks), df = {};
  docs.forEach((d) => new Set(d).forEach((w) => (df[w] = (df[w] || 0) + 1)));
  const pick = new Set([0]);
  for (const q of QUERIES) {
    const qt = toks(q);
    docs.map((d, i) => {
      const tf = {}; d.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
      let s = 0; qt.forEach((w) => { if (tf[w]) s += tf[w] * Math.log(1 + ch.length / df[w]); });
      return [s / Math.sqrt(d.length + 1), i];
    }).sort((a, b) => b[0] - a[0]).slice(0, 3).forEach(([s, i]) => s > 0 && pick.add(i));
  }
  let len = 0; const out = [];
  [...pick].sort((a, b) => a - b).forEach((i) => { if (len + ch[i].length < 6000) { out.push(ch[i]); len += ch[i].length; } });
  return out;
}

async function callClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) throw new Error('LLM error ' + r.status);
  const j = await r.json();
  const txt = j.content.map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(txt);
}

const DICT = 'python,java,javascript,typescript,c++,c#,go,rust,php,ruby,kotlin,swift,sql,html,css,react,angular,vue,node,express,django,flask,spring,fastapi,dotnet,mysql,postgresql,mongodb,oracle,redis,docker,kubernetes,aws,azure,gcp,git,jenkins,ci/cd,linux,terraform,rest api,graphql,excel,tableau,power bi,pandas,numpy,tensorflow,pytorch,scikit-learn,machine learning,deep learning,nlp,statistics,jira,agile,scrum,selenium,figma'.split(',');
exports.DICT = DICT;
const has = (text, k) => new RegExp('(^|[^a-z])' + k.replace(/[+.\/]/g, '\\$&') + '([^a-z]|$)').test(text);
exports.has = has;

exports.extractSkills = async (text) => {
  const low = text.toLowerCase().replace(/\s+/g, ' ');
  const flat = (s) => s.replace(/[.\s-]/g, '');
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const ctx = retrieve(text).join('\n---\n');
      const r = await callClaude(
`You extract skills from resume excerpts.
Rules: list only skills, tools, technologies, certifications and soft skills explicitly written in the excerpts. Do not guess or add related skills. Use short canonical names such as React, PostgreSQL, AWS.
Return only JSON: {"skills":{"Languages":[],"Frameworks and libraries":[],"Databases":[],"Cloud and DevOps":[],"Tools":[],"Certifications":[],"Soft skills":[]},"titles":[up to 3 fitting job titles],"years":number or null}

Resume excerpts:
${ctx}`);
      const skills = {};
      for (const [g, arr] of Object.entries(r.skills || {}))
        skills[g] = (arr || []).filter((s) => { const k = String(s).toLowerCase(); return low.includes(k) || flat(low).includes(flat(k)); });
      return { skills, titles: (r.titles || []).slice(0, 3), years: r.years ?? null, method: 'llm' };
    } catch (e) { console.warn('LLM extraction failed, using keyword scan:', e.message); }
  }
  return { skills: { 'Technical skills': DICT.filter((k) => has(low, k)) }, titles: [], years: null, method: 'keyword' };
};

// Flatten to the list used for job matching (certifications and soft skills excluded)
exports.technicalList = (skills) =>
  Object.entries(skills).filter(([g]) => !/soft|cert/i.test(g)).flatMap(([, a]) => a);
