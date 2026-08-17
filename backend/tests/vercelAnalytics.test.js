import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pkg from '../services/vercelAnalytics.js';

// The reader's job is to tell four states apart: no token, switched off, real
// figures, and broken. Conflating any two of them is the failure that matters —
// especially "switched off" reported as zero visitors, which reads as "nobody
// came" when it means "we never started counting".
const { isConfigured, getTraffic, getTrafficCached, _resetCache } = pkg;

const ok = body => ({ ok: true, json: async () => body });
const fail = (status, code, message) => ({
  ok: false,
  status,
  json: async () => ({ error: { code, message } }),
});

// The real response observed from the live project, which has never had Web
// Analytics enabled.
const notFound = () => fail(404, 'not_found', 'Web Analytics not found.');

const countBody = { data: { pageviews: 1250, visitors: 980 } };
const aggBody = key => ({
  data: [
    { [key]: 'alpha', count: 10, visitors: 8 },
    { [key]: 'beta', count: 5, visitors: 4 },
  ],
});

// Routes the four parallel calls getTraffic makes by URL.
function router(handlers) {
  return async url => {
    if (url.includes('/visits/count')) return handlers.count();
    if (url.includes('by=requestPath')) return handlers.paths();
    if (url.includes('by=referrerHostname')) return handlers.referrers();
    if (url.includes('by=deviceType')) return handlers.devices();
    throw new Error(`unexpected URL: ${url}`);
  };
}

const allOk = router({
  count: () => ok(countBody),
  paths: () => ok(aggBody('requestPath')),
  referrers: () => ok(aggBody('referrerHostname')),
  devices: () => ok(aggBody('deviceType')),
});

const env = { ...process.env };
beforeEach(() => {
  _resetCache();
  process.env.VERCEL_API_TOKEN = 'tok';
  process.env.VERCEL_PROJECT_ID = 'prj_test';
  process.env.VERCEL_TEAM_ID = 'team_test';
});
afterEach(() => { process.env = { ...env }; });

describe('vercel analytics reader', () => {
  it('is inert with no token, and says so rather than reporting zero', async () => {
    delete process.env.VERCEL_API_TOKEN;
    expect(isConfigured()).toBe(false);
    const out = await getTraffic({ fetchImpl: async () => { throw new Error('must not be called'); } });
    expect(out).toEqual({ configured: false });
    expect(out.visitors).toBeUndefined();
  });

  it('reads real figures', async () => {
    const out = await getTraffic({ fetchImpl: allOk });
    expect(out.configured).toBe(true);
    expect(out.enabled).toBe(true);
    expect(out.pageviews).toBe(1250);
    expect(out.visitors).toBe(980);
    expect(out.topPaths[0]).toEqual({ label: 'alpha', count: 10, visitors: 8 });
    expect(out.devices).toHaveLength(2);
  });

  // Observed live: the Vercel dashboard showed 7 visitors and 23 page views for
  // this project while this exact call 404'd, on a Hobby plan. The first version
  // of this file called that "never enabled" and sent the founder to switch on
  // something already running — the exact failure this service exists to prevent.
  it('reports a 404 as UNREADABLE, never as "not enabled" or zero traffic', async () => {
    const out = await getTraffic({ fetchImpl: router({
      count: notFound, paths: notFound, referrers: notFound, devices: notFound,
    }) });
    expect(out).toMatchObject({ configured: true, readable: false });
    // Must NOT claim anything about whether collection is switched on.
    expect(out.enabled).toBeUndefined();
    // And must never imply an empty shop.
    expect(out.visitors).toBeUndefined();
    expect(out.pageviews).toBeUndefined();
    // The advice has to allow for the dashboard being full of data.
    expect(out.detail).toMatch(/cannot READ/);
    expect(out.fix).toMatch(/If the dashboard has data/);
  });

  it('reports a genuine failure as an error, not as "not enabled"', async () => {
    const out = await getTraffic({ fetchImpl: router({
      count: () => fail(403, 'forbidden', 'Not authorized'),
      paths: () => fail(403, 'forbidden', 'Not authorized'),
      referrers: () => fail(403, 'forbidden', 'Not authorized'),
      devices: () => fail(403, 'forbidden', 'Not authorized'),
    }) });
    expect(out.configured).toBe(true);
    expect(out.enabled).toBeUndefined();
    expect(out.error).toBe('Not authorized');
  });

  it('survives a thrown fetch (network/timeout) without throwing', async () => {
    const out = await getTraffic({ fetchImpl: async () => { throw new Error('timed out'); } });
    expect(out).toEqual({ configured: true, error: 'timed out' });
  });

  it('sends the project and team, and asks only for production dimensions', async () => {
    const urls = [];
    await getTraffic({ fetchImpl: async url => { urls.push(url); return allOk(url); } });
    expect(urls).toHaveLength(4);
    for (const u of urls) {
      expect(u).toContain('projectId=prj_test');
      expect(u).toContain('teamId=team_test');
    }
    expect(urls.some(u => u.includes('/visits/count'))).toBe(true);
  });

  it('caches a good read instead of spending four calls per panel', async () => {
    let calls = 0;
    const counting = async url => { calls++; return allOk(url); };
    await getTrafficCached({ fetchImpl: counting });
    await getTrafficCached({ fetchImpl: counting });
    expect(calls).toBe(4); // four for the first read, none for the second
  });

  it('does not cache an error — a blip must not persist for 15 minutes', async () => {
    const out1 = await getTrafficCached({ fetchImpl: async () => { throw new Error('blip'); } });
    expect(out1.error).toBe('blip');
    // A later good read is served, not the cached failure.
    const out2 = await getTrafficCached({ fetchImpl: allOk });
    expect(out2.enabled).toBe(true);
  });
});

// The thresholds are a judgement about when a gap is worth reporting, so they
// are pinned here rather than left as numbers in a route. The asymmetry is the
// point: everything that makes a decision reads OUR number, so ours being
// silent is critical while ours being merely different is a warning.
describe('tracker agreement verdict', () => {
  const { agreementVerdict } = pkg;
  const v = (ours, theirs) => agreementVerdict({ ours, theirs, days: 14 });

  it('is critical when ours is silent and Vercel saw people', () => {
    const out = v(0, 40);
    expect(out.status).toBe('critical');
    // Must name the consequence, not just the discrepancy.
    expect(out.advice).toMatch(/empty shop/);
  });

  it('reports two zeroes as agreement on nothing, never as a fault', () => {
    const out = v(0, 0);
    expect(out.status).toBe('info');
    expect(out.detail).toMatch(/agree, but on nothing/);
  });

  it('is healthy when the two are close', () => {
    expect(v(100, 90).status).toBe('healthy');
    expect(v(90, 100).status).toBe('healthy');
  });

  it('warns when ours loses half the traffic Vercel sees', () => {
    const out = v(30, 100);
    expect(out.status).toBe('warning');
    expect(out.advice).toMatch(/ad blockers/);
  });

  it('warns the other way too, and blames bots rather than blockers', () => {
    const out = v(300, 100);
    expect(out.status).toBe('warning');
    expect(out.advice).toMatch(/bot traffic/);
  });

  it('stays quiet on a small sample, where variance looks like a fault', () => {
    // 5 vs 20 is a 4x gap, but 20 visitors is too few to accuse anything.
    expect(v(5, 20).status).toBe('healthy');
    // The same ratio with a real sample does get reported.
    expect(v(25, 100).status).toBe('warning');
  });
});
