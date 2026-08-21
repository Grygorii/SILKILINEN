import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pkg from '../services/seoIntel.js';

// A Programmable Search Engine searches only the sites it was built from unless
// it was created with "Search the entire web" — two different instruments
// behind one API, and the API never says which one you hold.
//
// This shop holds the site-list kind: ~40 curated competitors. Read as a SERP
// it says five boutiques own page one, so Hermes calls fights winnable that are
// owned by John Lewis and Net-a-Porter. Wrong, confident, and invisible.
//
// Hence: scope is DECLARED, and the default is the conservative reading.
const { serpAnalysis, serpConfigured, serpStatus, curatedSearch } = pkg;

const env = { ...process.env };
beforeEach(() => {
  process.env.GOOGLE_CSE_KEY = 'k';
  process.env.GOOGLE_CSE_ID = 'cx';
  process.env.GOOGLE_CSE_SCOPE = 'web';
});
afterEach(() => { process.env = { ...env }; });

// serpAnalysis calls global fetch; stub it per test.
function stubFetch(items) {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items }) });
}

const item = (host, n = 1) => ({
  title: `result ${n}`, snippet: 'x', link: `https://${host}/p${n}`, displayLink: host,
});

describe('search engine scope', () => {
  it('treats an undeclared engine as a site list, never as the web', () => {
    delete process.env.GOOGLE_CSE_SCOPE;
    expect(serpConfigured()).toBe(false);
    expect(serpStatus().state).toBe('sites');
  });

  it('only accepts the exact declaration', () => {
    for (const v of ['entire', 'whole-web', 'true', 'sites', '']) {
      process.env.GOOGLE_CSE_SCOPE = v;
      expect(serpConfigured()).toBe(false);
    }
    process.env.GOOGLE_CSE_SCOPE = 'WEB '; // case and whitespace are not typos
    expect(serpConfigured()).toBe(true);
  });

  it('tells "no credentials" apart from "wrong kind of engine"', () => {
    delete process.env.GOOGLE_CSE_KEY;
    expect(serpStatus().state).toBe('none');
    process.env.GOOGLE_CSE_KEY = 'k';
    process.env.GOOGLE_CSE_SCOPE = 'sites';
    const st = serpStatus();
    expect(st.state).toBe('sites');
    // Must not send the founder to set variables that are already set.
    expect(st.advice).toMatch(/Nothing to fix/);
  });
});

describe('live SERP', () => {
  it('is inert without credentials', async () => {
    delete process.env.GOOGLE_CSE_ID;
    expect((await serpAnalysis('silk pillowcase')).configured).toBe(false);
  });

  it('refuses to answer at all from a site-list engine, even a working one', async () => {
    process.env.GOOGLE_CSE_SCOPE = 'sites';
    // The engine WOULD answer, with five plausible-looking competitor pages.
    stubFetch([item('www.laperla.com', 1), item('eberjey.com', 2), item('lunya.co', 3)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.configured).toBe(false);
    expect(out.results).toEqual([]);
    // And says WHY, so nothing reports this as a missing API key.
    expect(out.siteRestricted).toBe(true);
    expect(out.reason).toMatch(/site-list engine/);
  });

  it('returns the competitive picture from a declared whole-web engine', async () => {
    stubFetch([item('www.johnlewis.com', 1), item('www.silkilinen.com', 2), item('www.net-a-porter.com', 3)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.results).toHaveLength(3);
    expect(out.siteRestricted).toBeUndefined();
  });

  // The declaration is the rule; this is the backstop for a declaration that
  // is wrong. An all-ours result set reads as "we hold positions 1 to 5".
  it('catches an engine declared web that behaves like a site list', async () => {
    stubFetch([item('www.silkilinen.com', 1), item('www.silkilinen.com', 2), item('www.silkilinen.com', 3)]);
    const out = await serpAnalysis('silk pillowcase');
    expect(out.siteRestricted).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.error).toMatch(/GOOGLE_CSE_ID/);
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

// The curated engine is a real asset — it just answers a different question.
describe('curated competitor search', () => {
  it('still reads the site list that serpAnalysis refuses', async () => {
    process.env.GOOGLE_CSE_SCOPE = 'sites';
    stubFetch([item('www.laperla.com', 1), item('lunya.co', 2)]);
    const out = await curatedSearch('silk pillowcase');
    expect(out.results).toHaveLength(2);
    // Carries its own scope so nothing downstream can forget which it holds.
    expect(out.scope).toBe('sites');
  });

  it('is inert without credentials', async () => {
    delete process.env.GOOGLE_CSE_KEY;
    expect((await curatedSearch('x')).configured).toBe(false);
  });
});
