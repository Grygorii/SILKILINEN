import { describe, it, expect } from 'vitest';
import pkg from '../utils/marketInsight.js';

// Driven by the real panel, which listed ten countries as ten identical tiles and
// left the reasoning to the reader — while inviting the opposite conclusion:
// Malta read as the best market (position 2!) on ONE impression, and the UK read
// as a failure while being 36% of everything Google shows the shop.
const { rankMarkets, marketHeadline, MIN_IMPRESSIONS } = pkg;

// The actual figures from the dashboard.
const LIVE = [
  { country: 'irl', clicks: 3, impressions: 40, position: 17.6 },
  { country: 'gbr', clicks: 2, impressions: 260, position: 19 },
  { country: 'dnk', clicks: 1, impressions: 6, position: 6.5 },
  { country: 'esp', clicks: 1, impressions: 18, position: 9.7 },
  { country: 'fra', clicks: 1, impressions: 10, position: 12.6 },
  { country: 'mlt', clicks: 1, impressions: 1, position: 2 },
  { country: 'nld', clicks: 1, impressions: 13, position: 5.1 },
  { country: 'pol', clicks: 1, impressions: 7, position: 9.7 },
  { country: 'swe', clicks: 1, impressions: 10, position: 8.6 },
  { country: 'are', clicks: 0, impressions: 7, position: 7.4 },
];

describe('which market to work on', () => {
  it('names the UK as the lever, not Ireland and not Malta', () => {
    const { lever } = rankMarkets(LIVE);
    expect(lever.name).toBe('United Kingdom');
    expect(lever.band).toBe('lever');
  });

  // Google attributes only 372 of the panel's 718 impressions to a country, so
  // the share depends on which total you mean. Both are true; blurring them is
  // what makes a dashboard uncheckable.
  it('reports share of ALL impressions when given the real total', () => {
    const { lever, basis } = rankMarkets(LIVE, { totalImpressions: 718 });
    expect(lever.share).toBe(36);
    expect(basis).toBe('all');
  });

  it('reports share of ATTRIBUTED traffic when the real total is unknown', () => {
    const { lever, basis, attributed } = rankMarkets(LIVE);
    expect(attributed).toBe(372);
    expect(lever.share).toBe(70);
    expect(basis).toBe('attributed');
  });

  it('does not trust a reported total smaller than the rows it was given', () => {
    // A stale or partial total must not produce a share above 100%.
    const { basis, lever } = rankMarkets(LIVE, { totalImpressions: 100 });
    expect(basis).toBe('attributed');
    expect(lever.share).toBeLessThanOrEqual(100);
  });

  it('puts the market to act on first', () => {
    const { markets } = rankMarkets(LIVE);
    expect(markets[0].name).toBe('United Kingdom');
  });

  it('refuses to call a one-impression market a winner', () => {
    // Malta at position 2 is one person, once. Ranked as a win it would send the
    // founder to build for a market that does not exist.
    const malta = rankMarkets(LIVE).markets.find(m => m.name === 'Malta');
    expect(malta.band).toBe('watch');
    expect(malta.impressions).toBeLessThan(MIN_IMPRESSIONS);
  });

  it('sorts every too-small market below every judged one', () => {
    const { markets } = rankMarkets(LIVE);
    const firstWatch = markets.findIndex(m => m.band === 'watch');
    const lastJudged = markets.map(m => m.band).lastIndexOf('foothold');
    expect(firstWatch).toBeGreaterThan(lastJudged);
  });

  it('separates "ranks badly" from "ranks well but nobody searches"', () => {
    const { markets } = rankMarkets(LIVE);
    const by = n => markets.find(m => m.name === n);
    // Volume, page two -> the work is ranking.
    expect(by('United Kingdom').band).toBe('lever');
    expect(by('Ireland').band).toBe('lever');
    // Volume, page one -> the work is demand.
    expect(by('Spain').band).toBe('foothold');
    // Good position but too few impressions to claim either.
    expect(by('Netherlands').band).toBe('watch');
  });

  it('writes a headline that names the market and the reason', () => {
    const line = marketHeadline(rankMarkets(LIVE, { totalImpressions: 718 }));
    expect(line).toMatch(/United Kingdom/);
    expect(line).toMatch(/36%/);
    expect(line).toMatch(/everything Google shows/);
    expect(line).toMatch(/page two/);
    // And it names the other basis when that is the one it used.
    expect(marketHeadline(rankMarkets(LIVE))).toMatch(/attributes to a country/);
  });

  it('says the opposite thing when the big market already ranks well', () => {
    const line = marketHeadline(rankMarkets([
      { country: 'gbr', clicks: 30, impressions: 400, position: 4 },
      { country: 'mlt', clicks: 1, impressions: 1, position: 2 },
    ]));
    // Nothing to fix in ranking — the limit is how many people search.
    expect(line).toMatch(/already ranks well/);
    expect(line).toMatch(/how many people search/);
  });

  it('says nothing at all when no market clears the floor', () => {
    // Silence is the honest output; inventing a "top market" from three
    // impressions is how a panel teaches you to stop believing it.
    const ranked = rankMarkets([
      { country: 'mlt', clicks: 1, impressions: 1, position: 2 },
      { country: 'lux', clicks: 0, impressions: 3, position: 5 },
    ]);
    expect(ranked.lever).toBeNull();
    expect(marketHeadline(ranked)).toBeNull();
  });

  it('survives empty or missing data without throwing', () => {
    for (const input of [[], null, undefined]) {
      const ranked = rankMarkets(input);
      expect(ranked.markets).toEqual([]);
      expect(marketHeadline(ranked)).toBeNull();
    }
  });

  it('ignores a market with no impressions rather than dividing by zero', () => {
    const ranked = rankMarkets([{ country: 'usa', clicks: 0, impressions: 0, position: 0 }]);
    expect(ranked.markets).toEqual([]);
    expect(ranked.totalImpressions).toBe(0);
  });
});
