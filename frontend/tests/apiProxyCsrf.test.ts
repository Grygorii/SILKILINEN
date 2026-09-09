import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every write from a Next route handler to the Railway backend must carry a
// custom header, because backend/middleware/csrf.js requires one on every
// non-safe method and exempts only the Stripe webhook.
//
// Two of the three proxies did not, and the cost was invisible by design:
// the tracking proxies fire-and-forget with `.catch(() => {})` and return
// `{ ok: true }` to the browser whatever happens. So every visit and every
// clickstream event was 403'd at the backend, the browser saw success, nothing
// was logged, and the Visit collection stayed empty — while Vercel Analytics
// counted 78 visitors over 14 days. The funnel, the advisor and every agent
// read OUR number, so all of them were describing a shop nobody had opened.
//
// app/api/admin-session/route.ts has carried the header since F8 with a comment
// explaining why. The rule was known and written down in one file out of three,
// which is this codebase's signature failure: a rule with no owner and no guard.
const API_DIR = join(__dirname, '..', 'app', 'api');
const WRITES = /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/;
const CSRF = /['"](X-CSRF-Token|X-Requested-With)['"]/;

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) routeFiles(p, out);
    else if (e === 'route.ts' || e === 'route.tsx') out.push(p);
  }
  return out;
}

describe('Next route handlers writing to the backend', () => {
  const files = routeFiles(API_DIR);

  it('finds the route handlers', () => {
    expect(files.length).toBeGreaterThan(2);
  });

  it('send a CSRF header on every write, or the backend 403s them silently', () => {
    // File-level, not call-level: a handler that writes to the backend must
    // mention the header somewhere. Coarse on purpose — a precise per-call
    // check would need a parser, and the failure this catches is a whole file
    // that never heard of the rule.
    const missing = files.filter(f => {
      const src = readFileSync(f, 'utf8');
      if (!/API_URL/.test(src)) return false;   // not talking to the backend
      if (!WRITES.test(src)) return false;      // reads only
      return !CSRF.test(src);
    }).map(f => f.slice(f.indexOf('app/api')));

    expect(missing, 'these writes are refused by backend/middleware/csrf.js').toEqual([]);
  });
});
