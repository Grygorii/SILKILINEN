'use strict';

// A sample-gated review cue, never a statement of proven demand or sales potential.
const MIN_IMPRESSIONS = 100;
// A heuristic threshold for a query/page review cue, not a results-page number.
const PAGE_ONE = 10;

// GSC uses ISO-3; these are the markets the shop actually sees.
const NAMES = {
  bra: 'Brazil', sgp: 'Singapore', chn: 'China',
  gbr: 'United Kingdom', irl: 'Ireland', usa: 'United States', deu: 'Germany',
  fra: 'France', esp: 'Spain', ita: 'Italy', nld: 'Netherlands', bel: 'Belgium',
  swe: 'Sweden', dnk: 'Denmark', nor: 'Norway', fin: 'Finland', pol: 'Poland',
  prt: 'Portugal', aut: 'Austria', che: 'Switzerland', are: 'UAE', aus: 'Australia',
  can: 'Canada', nzl: 'New Zealand', mlt: 'Malta', lux: 'Luxembourg', cze: 'Czechia',
};

function countryName(code) {
  const c = String(code || '').toLowerCase();
  return NAMES[c] || String(code || '').toUpperCase();
}

/**
 * @param {Array<{country, clicks, impressions, position}>} countries
 * @returns {{markets: Array, lever: object|null, totalImpressions: number, minImpressions: number}}
 *   `markets` is ordered so the one to act on is first.
 */
function rankMarkets(countries = [], { totalImpressions: reportedTotal = null } = {}) {
  const rows = (countries || []).filter(c => c && Number(c.impressions) > 0);
  const attributed = rows.reduce((n, c) => n + Number(c.impressions || 0), 0);

  // Share of WHAT matters. Google attributes only some impressions to a country
  // and caps the country list, so these rows sum to less than the reported total
  // — 372 against 718 on the live panel. Against the true total the UK is 36% of
  // everything; against the countries listed it is 70%. Both are true and they
  // are different claims, so the caller passes the real total when it has one and
  // `basis` records which question was answered.
  const basis = reportedTotal && reportedTotal >= attributed ? 'all' : 'attributed';
  const totalImpressions = basis === 'all' ? reportedTotal : attributed;

  const markets = rows.map(c => {
    const impressions = Number(c.impressions) || 0;
    const position = Number(c.position) || 0;
    const clicks = Number(c.clicks) || 0;
    const share = totalImpressions ? Math.round((impressions / totalImpressions) * 100) : 0;

    let band = 'watch';
    if (impressions >= MIN_IMPRESSIONS && position > 0) band = position > PAGE_ONE ? 'lever' : 'foothold';

    return { code: c.country, name: countryName(c.country), clicks, impressions, position, share, band };
  });

  // Review candidates first, then stronger average positions, then small samples.
  // Impression volume is visibility, not proof of demand or conversions.
  const order = { lever: 0, foothold: 1, watch: 2 };
  markets.sort((a, b) => order[a.band] - order[b.band] || b.impressions - a.impressions);

  const lever = markets.find(m => m.band === 'lever') || null;
  return { markets, lever, totalImpressions, attributed, basis, minImpressions: MIN_IMPRESSIONS };
}

/**
 * One sentence naming the market to work on, or null when nothing clears the
 * floor. Null is a real answer: with no market above the floor there is nothing
 * to say, and saying something anyway is how a dashboard trains you to ignore it.
 */
function marketHeadline(ranked) {
  const { lever, markets, basis } = ranked || {};
  // Say which total the percentage is a share OF. "36% of everything" and "70%"
  // of the traffic Google attributes to a country" are different claims, and a
  // panel that blurs them is one nobody can check.
  const of = basis === 'all'
    ? 'of everything Google shows the shop'
    : 'of the traffic Google attributes to a country';
  if (lever) {
    return `${lever.name} accounts for ${lever.impressions} impressions (${lever.share}% ${of}) at average position ${lever.position}. Review the underlying queries and pages. An average is not a search-results page number or proof of buying demand.`;
  }
  const best = (markets || []).find(m => m.band === 'foothold');
  if (best) {
    return `${best.name} has ${best.impressions} impressions at average position ${best.position}. Inspect relevant queries and shopping intent; country averages do not establish sales potential.`;
  }
  return null;
}

module.exports = { rankMarkets, marketHeadline, MIN_IMPRESSIONS, PAGE_ONE, countryName };
