import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The brand's star average has one owner: GET /api/reviews/summary, which
// averages every APPROVED review at any rating. Four surfaces read it — the
// homepage strip, the Organization JSON-LD in app/layout.tsx, ProductReviews,
// and now the reviews page, which used to compute its own.
//
// Why a scan rather than a unit test: the failure is not a wrong function, it
// is a SECOND function. Nothing is broken at the moment one appears — it agrees
// with the owner on the day it is written, and diverges later, quietly, when
// the endpoint it happens to read starts paginating or sorting differently.
//
// What makes it expensive is where the number ends up. The same average is
// emitted as schema.org aggregateRating, so it is a claim made to Google and,
// for reviews shown to EU/UK shoppers, a regulated statement about what
// customers actually said. Two answers to "what do people rate this" is the
// one arithmetic on the storefront that has a legal edge.

const ROOT = join(__dirname, '..');
const CANONICAL = '/api/reviews/summary';

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Storefront only. Admin may legitimately aggregate for its own reporting.
const FILES = [
  ...tsxFiles(join(ROOT, 'app', '(shop)')),
  ...tsxFiles(join(ROOT, 'components')),
  join(ROOT, 'app', 'layout.tsx'),
];

describe('review aggregate has one owner', () => {
  it('scans a real set of files', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('no storefront surface computes its own star average', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      // A reduce, a sum or a division whose operand is the rating field. The
      // shape the reviews page had was:
      //   reviews.reduce((s, r) => s + r.starRating, 0) / total
      if (/reduce\([\s\S]*?starRating/.test(src) || /starRating[^\n]*\/\s*(?:total|count|length)/.test(src)) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    expect(offenders, `these derive an average instead of reading ${CANONICAL}`).toEqual([]);
  });

  it('the reviews page reads the canonical summary', () => {
    const src = readFileSync(join(ROOT, 'app', '(shop)', 'reviews', 'page.tsx'), 'utf8');
    expect(src).toContain(CANONICAL);
  });
});
