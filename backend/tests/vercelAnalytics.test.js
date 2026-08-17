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

  it('reports "never enabled" as its own state, NOT as zero traffic', async () => {
    const out = await getTraffic({ fetchImpl: router({
      count: notFound, paths: notFound, referrers: notFound, devices: notFound,
    }) });
    expect(out).toMatchObject({ configured: true, enabled: false });
    // The dangerous confusion: a zero that reads as "nobody came".
    expect(out.visitors).toBeUndefined();
    expect(out.pageviews).toBeUndefined();
    expect(out.fix).toMatch(/Analytics/);
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
