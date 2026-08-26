import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Homepage copy lives in the CMS, which means the same sentence is written in
// three files and none of them can see the others:
//
//   seedSiteContent.js    the value a FRESH database gets. It only ever
//                         CREATES — an existing key is skipped — so editing it
//                         changes nothing about the site that is running.
//   fixOriginContent.js   the only one that changes what is live today, by
//                         overwriting existing keys. Its own comment says it
//                         "mirrors the corrected defaults in seedSiteContent",
//                         which is a promise no code was keeping: it was
//                         missing homepage_hero_title entirely.
//   page.tsx              the code default, which renders when the CMS is
//                         unreachable. A stale one turns an API outage into a
//                         page quietly showing last season's words.
//
// Three copies of one sentence is the shape this codebase keeps getting wrong.
// There is no single owner available here — the frontend cannot require the
// backend — so the guard is the next best thing: assert they still agree.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const seed = read('backend/scripts/seedSiteContent.js');
const fixes = read('backend/scripts/fixOriginContent.js');
const homepage = read('frontend/app/(shop)/page.tsx');

// Single-line single-quoted entries of the FIXES map. Multi-line values (the
// story prose, with its embedded newlines and escapes) are deliberately out of
// scope — a regex is the wrong tool for those and a wrong guard is worse than
// none.
const fixEntries = [...fixes.matchAll(/^ {2}([a-z0-9_]+): '((?:[^'\\]|\\.)*)',$/gm)]
  .map(([, key, value]) => ({ key, value }));

describe('site copy stays in sync across its three writers', () => {
  it('finds the single-line fixes to check', () => {
    // If this drops to nothing the regex has stopped matching and every
    // assertion below would pass vacuously.
    expect(fixEntries.length).toBeGreaterThanOrEqual(3);
  });

  it('seeds a fresh database with the same words the migration writes', () => {
    for (const { key, value } of fixEntries) {
      expect(seed.includes(`'${value}'`), `${key}: seedSiteContent.js does not contain the fixed value`).toBe(true);
    }
  });

  it('falls back to the same hero copy when the CMS is unreachable', () => {
    // The two keys the homepage carries its own default for. Both are read
    // through val(content, key, default).
    for (const key of ['homepage_hero_title', 'homepage_hero_subtitle']) {
      const fix = fixEntries.find(e => e.key === key);
      expect(fix, `${key} is not in fixOriginContent.js`).toBeTruthy();
      const declared = homepage.match(
        new RegExp(`val\\(content, '${key}', '((?:[^'\\\\]|\\\\.)*)'\\)`),
      );
      expect(declared, `${key} default not found in page.tsx`).toBeTruthy();
      expect(declared[1], `${key} code default has drifted from the CMS value`).toBe(fix.value);
    }
  });
});
