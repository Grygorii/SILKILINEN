'use strict';
const DAY = 86400000;
function searchWindows(days = 28, now = new Date()) {
  days = Math.min(90, Math.max(1, Math.floor(Number(days) || 28)));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
  const at = Date.parse(`${today}T12:00:00Z`), date = ago => new Date(at - ago * DAY).toISOString().slice(0, 10);
  return { current: { startDate: date(days + 1), endDate: date(2) }, previous: { startDate: date(days * 2 + 1), endDate: date(days + 2) }, days };
}
function pageKind(url) {
  let path; try { path = new URL(url, 'https://www.silkilinen.com').pathname; } catch { return 'other'; }
  return path.startsWith('/journal/') ? 'editorial' : /^\/(product|shop|collection)(\/|$)/.test(path) ? 'shopping' : path === '/' ? 'home' : 'other';
}
function searchPriorities(pages = []) {
  return pages.filter(row => row.impressions >= 50).map(row => {
    const kind = pageKind(row.key);
    const action = kind === 'editorial'
      ? 'Check matching queries and add a contextual route to a relevant in-stock product or collection. Measure product visits, not only article clicks.'
      : row.position > 5 && row.position <= 20
        ? 'Inspect the query-to-page match, then improve product/category information and relevant internal links. Keep the established URL.'
        : row.ctr < .02 ? 'Compare query intent, title and snippet with the page. Low CTR is a review cue, not proof that the title is wrong.'
          : 'Preserve the working page; review product visits and attributable orders before expanding it.';
    return { ...row, kind, action, evidence: 'Review candidate, not a guaranteed ranking or sales gain' };
  }).sort((a,b) => (b.kind === 'shopping' ? 1 : 0) - (a.kind === 'shopping' ? 1 : 0) || b.impressions - a.impressions).slice(0, 6);
}
module.exports = { searchWindows, pageKind, searchPriorities };
