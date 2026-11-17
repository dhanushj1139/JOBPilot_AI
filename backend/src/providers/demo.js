// Demo provider: realistic sample jobs, no API keys. Only active when DEMO_MODE=1.
const ROLES = [["Software Engineer",["python","java","sql","git","rest api"]],["Frontend Developer",["javascript","react","html","css","typescript"]],
  ["Data Analyst",["sql","python","excel","tableau","statistics"]],["Backend Developer",["node","sql","docker","rest api","mongodb"]],
  ["Full Stack Developer",["react","node","javascript","sql","git"]],["DevOps Engineer",["docker","kubernetes","aws","linux","ci/cd"]],
  ["ML Engineer",["python","tensorflow","statistics","sql","docker"]]];
const COMP = ["Nimbus Labs","Orbit Systems","Greenleaf Tech","Quanta Soft","BlueHarbor","Pixelwave","Northstar","Kite Analytics","Zenith Cloud","Brightpath"];
const CITIES = { India:["Hyderabad","Bengaluru","Pune","Chennai","Mumbai"], 'United States':["New York","Austin","San Francisco","Seattle"],
  'United Kingdom':["London","Manchester"], Germany:["Berlin","Munich"], Canada:["Toronto","Vancouver"], Australia:["Sydney","Melbourne"], France:["Paris"] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const calls = new Map();

function make({ skills, titles, country, city }, minAgo) {
  const tailored = Math.random() < 0.55 && skills.length >= 2; // about half match the user's skills, so scores vary
  const base = pick(ROLES);
  const title = tailored && titles.length ? pick(titles) : base[0];
  const req = [...new Set(tailored ? shuffle(skills).slice(0, 4).concat(shuffle(base[1]).slice(0, 1)) : base[1])];
  const c = city && Math.random() < 0.4 ? city : pick(CITIES[country] || [city || 'Remote']);
  const id = `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { provider: 'demo', ext_id: id, title, company: pick(COMP), country, city: c,
    description: `We are hiring a ${title}. Required skills: ${req.join(', ')}. You will build and ship features with a small team.`,
    url: `https://example.com/jobs/${id}`, posted_at: Date.now() - minAgo * 60000 };
}

module.exports = {
  name: 'demo',
  canApply: true, // simulated: marks the application as sent, nothing leaves your computer
  enabled: () => process.env.DEMO_MODE === '1',
  async search(p) {
    const key = p.skills.join() + p.city, n = calls.get(key) || 0; calls.set(key, n + 1);
    const count = n === 0 ? 18 : Math.random() < 0.7 ? 1 : 2; // first run seeds the day, later runs add fresh jobs
    return Array.from({ length: count }, () => make(p, n === 0 ? Math.floor(Math.random() * 1300) + 5 : Math.floor(Math.random() * 2)));
  },
  async apply() {},
};
