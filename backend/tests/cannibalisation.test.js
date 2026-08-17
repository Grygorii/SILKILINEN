import { describe, it, expect } from 'vitest';
import pkg from '../services/seoIntel.js';

// Search Console keeps reporting a URL for weeks after it starts redirecting, so
// a rename looks exactly like cannibalisation: the old URL and the new one are
// counted as two pages competing for one query.
//
// This is the real case from the panel. Renaming the catalogue and merging the
// categories made ONE product page look like three competitors:
//   /product/mulberry-silk-pillowcase-sage-green  pos 12    (old slug, 301s)
//   /product/silk-pillowcase-in-sage-green        pos 21    (the same page, today)
//   /shop?category=pillowcases                    pos 36.7  (merged into `home`, 301s)
// Nothing was competing with anything, but the plan said "consolidate to one
// strong page" — wasted work at best, and an invitation to delete or noindex a
// page that is already correct at worst.
const { detectCannibalisation } = pkg;

const CURRENT = '/product/silk-pillowcase-in-sage-green';

// The resolver hermes.js builds from live data: any slug the product has ever
// had maps to its path today; a dead category or deleted product maps to null.
const canonical = page => {
  const path = String(page).replace(/^https?:\/\/[^/]+/, '');
  if (path === '/product/mulberry-silk-pillowcase-sage-green') return CURRENT;
  if (path === CURRENT) return CURRENT;
  if (path === '/shop?category=pillowcases') return null;   // merged into `home`
  if (path === '/product/deleted-thing') return null;       // product is gone
  return path;
};

const row = (query, page, position, impressions = 10) => ({ query, page, position, impressions });

describe('cannibalisation detection', () => {
  it('does not flag one page reported under its old and new URLs', () => {
    const out = detectCannibalisation([
      row('sage green silk pillowcase', '/product/mulberry-silk-pillowcase-sage-green', 12),
      row('sage green silk pillowcase', CURRENT, 21),
      row('sage green silk pillowcase', '/shop?category=pillowcases', 36.7),
    ], { canonical });
    expect(out).toEqual([]);
  });

  it('does not flag a live page against a merged-away category', () => {
    const out = detectCannibalisation([
      row('sage silk pillowcase', '/shop?category=pillowcases', 19.5),
      row('sage silk pillowcase', '/product/mulberry-silk-pillowcase-sage-green', 26.3),
    ], { canonical });
    expect(out).toEqual([]);
  });

  it('still flags genuine cannibalisation between two live pages', () => {
    // The check must not become useless: two pages that both still exist and
    // both rank for one query is the real problem it was written for.
    const out = detectCannibalisation([
      row('silk robe', '/product/silk-robe-in-garnet', 8),
      row('silk robe', '/shop?category=robes', 14),
    ], { canonical });
    expect(out).toHaveLength(1);
    expect(out[0].query).toBe('silk robe');
    expect(out[0].pages.map(p => p.page)).toEqual(['/product/silk-robe-in-garnet', '/shop?category=robes']);
  });

  it('keeps the better-ranking URL of a redirected pair for display', () => {
    // When an old and a new URL collapse, the surviving row should be the one
    // Google currently favours, not whichever was seen first.
    const out = detectCannibalisation([
      row('sage green silk pillowcase', CURRENT, 21),
      row('sage green silk pillowcase', '/product/mulberry-silk-pillowcase-sage-green', 12),
      row('sage green silk pillowcase', '/shop?category=lingerie', 30),
    ], { canonical });
    expect(out).toHaveLength(1);
    expect(out[0].pages[0].position).toBe(12);
  });

  it('behaves exactly as before when no resolver is supplied', () => {
    // Callers that have no live catalogue to hand must not silently lose the check.
    const rows = [
      row('silk robe', '/a', 8),
      row('silk robe', '/b', 14),
    ];
    expect(detectCannibalisation(rows)).toHaveLength(1);
  });

  it('still ignores pages below the impressions floor', () => {
    const out = detectCannibalisation([
      row('silk robe', '/a', 8, 1),
      row('silk robe', '/b', 14, 1),
    ], { canonical });
    expect(out).toEqual([]);
  });

  it('drops a deleted product rather than treating it as a competitor', () => {
    const out = detectCannibalisation([
      row('silk robe', '/product/deleted-thing', 9),
      row('silk robe', '/shop?category=robes', 15),
    ], { canonical });
    expect(out).toEqual([]);
  });
});
