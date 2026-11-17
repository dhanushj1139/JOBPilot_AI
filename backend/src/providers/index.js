// Every provider implements: search({skills,titles,country,city,token}) -> normalized jobs, and optional apply().
const adzuna = require('./adzuna');
const jooble = require('./jooble');
const demo = require('./demo');
const jsearch = require('./jsearch');
// LinkedIn, Naukri, Indeed etc. do not offer public job-search or apply APIs.
// These adapters only switch on when you hold an approved partner agreement and token.
const partner = (name, envVar) => ({
  name,
  enabled: () => !!process.env[envVar],
  async search() { throw new Error(`${name}: implement against the partner API docs you were given`); },
  async apply() { throw new Error(`${name}: implement apply against the partner API`); },
  canApply: true,
});

const providers = [demo, adzuna, jooble, jsearch,
  partner('linkedin', 'LINKEDIN_PARTNER_TOKEN'),
  partner('naukri', 'NAUKRI_PARTNER_TOKEN'),
  partner('indeed', 'INDEED_PARTNER_TOKEN')];

exports.all = () => providers.filter((p) => p.enabled());
exports.get = (name) => providers.find((p) => p.name === name);
exports.names = () => providers.filter((p) => p.name !== 'demo' || p.enabled()).map((p) => ({ name: p.name, enabled: p.enabled() }));
