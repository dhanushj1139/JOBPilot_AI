
// Jooble REST API provider for India.
// IMPORTANT: JOOBLE_API_KEY must be generated at https://in.jooble.org/api/about
// The global jooble.org key is restricted to the US market.
// Jooble's free plan currently allows 100 requests/day per country-specific key.

const API_BASE = (
  process.env.JOOBLE_API_BASE || 'https://in.jooble.org/api'
).replace(/\/+$/, '');

function clean(value) {
  return String(value || '')
    .replace(/<\/?[^>]+>/g, '')
    .trim();
}

module.exports = {
  name: 'jooble',
  canApply: false, // Applications are completed on the employer's website.

  enabled: () => Boolean(process.env.JOOBLE_API_KEY),

  async search({ skills = [], titles = [], country, city }) {

    // Search India only.
    if (String(country || '').toLowerCase() !== 'india') {
      return [];
    }

    // Use the first available job title.
    // If no title exists, use the first two skills.
    const query =
      titles.find(Boolean) ||
      skills.filter(Boolean).slice(0, 2).join(' ');

    if (!query) return [];

    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(process.env.JOOBLE_API_KEY)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords: query,
          location: city ? `${city}, India` : 'India',
          page: 1,
          companysearch: false
        })
      }
    );

    if (!response.ok) {
      const message =
        response.status === 403
          ? 'Jooble rejected the API key. Check that JOOBLE_API_KEY is an India key from in.jooble.org/api/about.'
          : response.status === 429
            ? 'Jooble daily API request limit reached. Reduce FETCH_CRON frequency or request a higher limit.'
            : `Jooble API request failed with HTTP ${response.status}.`;

      throw new Error(message);
    }

    const payload = await response.json();

    return (payload.jobs || [])
      .map((job) => ({
        provider: 'jooble',
        ext_id: String(job.id),
        title: clean(job.title),
        company: clean(job.company),
        country: 'India',
        city: clean(job.location).split(',')[0].trim(),
        description: clean(job.snippet),
        url: job.link,
        posted_at: Date.parse(job.updated) || Date.now()
      }))
      .filter(
        (job) =>
          job.ext_id &&
          job.title &&
          /^https?:\/\//i.test(job.url || '')
      );
  }
};
