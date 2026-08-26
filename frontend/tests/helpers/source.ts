// Shared helpers for the tests that scan source files.
//
// Several invariants here are enforced by reading the codebase rather than by
// calling a function — "no storefront file derives a review average", "no file
// promises no customs without naming Derry", "the domain is written once".
// They all need the same two things, and the comment stripper had been written
// twice before this file existed.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Source with comments removed.
 *
 * Every scan here is about what reaches a CUSTOMER or a CRAWLER, and a comment
 * reaches neither. Without this, an accurate note about the code fails the
 * build for saying the thing it is describing — which is how a guard gets
 * loosened until it stops guarding. backend/utils/originClaims.js takes the
 * same view for the same reason.
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    // Whole-line // and JSDoc continuations. Deliberately not trailing
    // comments: a URL contains // and stripping from there would eat real code.
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/** Every .ts/.tsx file under `dir`, skipping build output and any named directory. */
export function sourceFiles(dir: string, { skipDirs = [] as string[] } = {}): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
      if (skipDirs.includes(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}
