'use strict';

// Which market is actually worth working on.
//
// The panel listed ten countries as ten identical tiles, so the founder had to
// do the reasoning that matters — and the layout actively invited the wrong
// conclusion. Malta showed "1 clk · 1 imp · pos 2", which reads like the shop's
// best market, and the United Kingdom showed "2 clk · 260 imp · pos 19", which
// reads like a failure. It is the other way round: Malta is a single impression
// (one person, once, and position 2 of a search nobody else ran), while the UK
// is 36% of everything Google shows the shop, sitting on page two.
//
// The rule: a market is only worth naming when it has enough impressions to mean
// something, and then what matters is whether Google already ranks it well.
//   • lever    — real volume, poor position. Google shows the shop and shoppers
//                never scroll that far. The most impressions here is THE market
//                to work on, because the demand is proven and only the rank is
//                missing.
//   • foothold — real volume, good position. Already winning; grow the demand.
//   • watch    — below the floor. Not a verdict, not a win, just too small.
//
// Deliberately conservative in the same way as the funnel's segment gates: a
// market named on one impression is a coin flip presented as a strategy.

// Below this an average position is a single search away from meaningless.
const MIN_IMPRESSIONS = 15;
// Google's first page is ~10 results; beyond it, CTR collapses to near zero, so
// this is the line between "ranked" and "shown but never seen".
const PAGE_ONE = 10;

// GSC uses ISO-3; these are the markets the shop actually sees.
const NAMES = {
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
    if (impressions >= MIN_IMPRESSIONS) band = position > PAGE_ONE ? 'lever' : 'foothold';

    return { code: c.country, name: countryName(c.country), clicks, impressions, position, share, band };
  });

  // Levers first (biggest proven demand that is not converting because of rank),
  // then footholds, then everything too small to judge. Within a band, the most
  // impressions — the amount of demand at stake, not the prettiest number.
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
  // Say which total the percentage is a share OF. "36% of everything" and "70%
  // of the traffic Google attributes to a country" are different claims, and a
  // panel that blurs them is one nobody can check.
  const of = basis === 'all'
    ? 'of everything Google shows the shop'
    : 'of the traffic Google attributes to a country';
  if (lever) {
    return `${lever.name} is ${lever.share}% ${of} — ${lever.impressions} impressions — but sits at position ${lever.position}, which is page two. The demand is already there; only the ranking is missing.`;
  }
  const best = (markets || []).find(m => m.band === 'foothold');
  if (best) {
    return `${best.name} is the strongest market (${best.impressions} impressions at position ${best.position}) and already ranks well. The limit here is how many people search, not where the shop appears.`;
  }
  return null;
}

module.exports = { rankMarkets, marketHeadline, MIN_IMPRESSIONS, PAGE_ONE, countryName };
