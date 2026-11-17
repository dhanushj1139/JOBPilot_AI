
const API_URL = 'https://api.openwebninja.com/jsearch/search-v2';

function clean(value) {
  return String(value || '')
    .replace(/<\/?[^>]+>/g, '')
    .trim();
}

module.exports = {
  name: 'jsearch',
  canApply: false,

  enabled: () => Boolean(process.env.JSEARCH_API_KEY),

  async search({ skills = [], titles = [], country, city }) {

    // India-only integration for JobPilot.
    if (String(country || '').toLowerCase() !== 'india') {
      return [];
    }

    // Prefer the user's job title.
    const title = titles.find(Boolean);

    // Use skills if no job title is available.
    const keyword = title || skills.filter(Boolean).slice(0, 2).join(' ');

    if (!keyword) return [];

    const location = city ? `${city}, India` : 'India';

    const params = new URLSearchParams({
      query: `${keyword} jobs in ${location}`,
      country: 'in',
      language: 'en',
      num_pages: '1'
    });

    const response = await fetch(`${API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.JSEARCH_API_KEY
      }
    });

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? 'JSearch API key is invalid or unauthorized.'
          : response.status === 429
            ? 'JSearch API request limit exceeded.'
            : `JSearch API failed with HTTP ${response.status}.`;

      throw new Error(message);
    }

    const payload = await response.json();

    // Support the documented data response and common nested jobs shape.
    const jobs = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.jobs)
        ? payload.data.jobs
        : [];

    return jobs.map((job) => {
      const postedAt =
        Number(job.job_posted_at_timestamp) * 1000 ||
        Date.parse(job.job_posted_at_datetime_utc) ||
        0;

      return {
        provider: 'jsearch',
        ext_id: String(job.job_id),
        title: clean(job.job_title),
        company: clean(job.employer_name),
        country: 'India',
        city: clean(job.job_city || job.job_location).split(',')[0].trim(),
        description: clean(job.job_description),
        url: job.job_apply_link || job.job_google_link,
        posted_at: postedAt
      };
    }).filter((job) =>
      job.ext_id &&
      job.title &&
      /^https?:\/\//i.test(job.url || '')
    );
  }
};
