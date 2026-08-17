import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pkg from '../services/seoIntel.js';

// A Programmable Search Engine defaults to searching only the sites it was
// created from. Created from silkilinen.com, every query returns five of our own
// pages — and the agents read that as "we hold positions 1 to 5 for everything",
// then recommend nothing. Worse than having no SERP at all: an absent signal is
// visible, a wrong one is not.
const { serpAnalysis, serpConfigured } = pkg;

const env = { ...process.env };
beforeEach(() => {
  process.env.GOOGLE_CSE_KEY = 'k';
  process.env.GOOGLE_CSE_ID = 'cx';
});
afterEach(() => { process.env = { ...env }; });

// serpAnalysis calls global fetch; stub it per test.
function stubFetch(items) {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items }) });
}

const item = (host, n = 1) => ({
  title: `result ${n}`, snippet: 'x', link: `https://${host}/p${n}`, displayLink: host,
});

describe('live SERP', () => {
  it('is inert without both credentials', async () => {
    delete process.env.GOOGLE_CSE_ID;
    expect(serpConfigured()).toBe(false);
    expect((await serpAnalysis('silk pillowcase')).configured).toBe(false);
  });

  it('returns the competitive picture when the engine searches the web', async () => {
    stubFetch([item('www.johnlewis.com', 1), item('www.silkilinen.com', 2), item('www.net-a-porter.com', 3)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.results).toHaveLength(3);
    expect(out.siteRestricted).toBeUndefined();
  });

  it('refuses to report an all-ours result set as a ranking', async () => {
    // This is what a site-restricted engine returns for every single query.
    stubFetch([item('www.silkilinen.com', 1), item('www.silkilinen.com', 2), item('www.silkilinen.com', 3)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.siteRestricted).toBe(true);
    // Crucially: no results handed onward, so nothing can read them as positions.
    expect(out.results).toEqual([]);
    expect(out.error).toMatch(/Search the entire web/);
  });

  it('does not cry misconfiguration when we genuinely rank alongside others', async () => {
    stubFetch([item('www.silkilinen.com', 1), item('www.selfridges.com', 2)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.siteRestricted).toBeUndefined();
    expect(out.results).toHaveLength(2);
  });

  it('says nothing about an empty result set', async () => {
    // No results is a query nobody ranks for, not a broken engine.
    stubFetch([]);
    const out = await serpAnalysis('a query with no results at all');
    expect(out.siteRestricted).toBeUndefined();
    expect(out.results).toEqual([]);
  });
});
