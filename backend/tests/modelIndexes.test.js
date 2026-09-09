import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'models');

// Mongoose builds an index from a PATH that declares `index`, `unique` or
// `sparse`, and another from every `schema.index()` call. Declare the same key
// both ways and it warns — "Duplicate schema index on {slug:1}" — and then does
// something worse than warn, because MongoDB will not create two indexes with
// one key pattern. Whichever is built first wins and the other is refused.
//
// That silence cost two different things here:
//
//   Product.slug   the path said `sparse` (not unique) while the explicit index
//                  said unique+sparse. Slug uniqueness is what stops two
//                  products claiming one URL — and which declaration was in
//                  force depended on the order Atlas happened to build them in.
//
//   Event.createdAt / Visit.createdAt
//                  the explicit index is a 90-day TTL. The path's plain
//                  `index: true` has the same key, so the TTL index can simply
//                  fail to be created — and the clickstream then grows for ever
//                  while looking exactly like a retention policy that works.
//
// One declaration per key. Whichever side carries the more specific options
// survives; the other goes.
const PATH_OPTION = /^\s*([A-Za-z_$][\w$]*)\s*:\s*\{[^}\n]*\b(?:index|unique|sparse)\s*:\s*true/gm;
// An EXACT single-field index() — a COMPOUND index starting with the same field
// is a different key pattern and perfectly legitimate alongside a path index.
const EXACT_INDEX = /\.index\(\s*\{\s*([A-Za-z_$][\w$]*)\s*:\s*-?1\s*\}/g;

function offenders(src) {
  const paths = new Set([...src.matchAll(PATH_OPTION)].map(m => m[1]));
  const exact = new Set([...src.matchAll(EXACT_INDEX)].map(m => m[1]));
  return [...exact].filter(f => paths.has(f));
}

describe('model indexes are declared once', () => {
  const files = fs.readdirSync(MODELS).filter(f => f.endsWith('.js'));

  it('finds the models', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never declares the same single-field index on the path AND in schema.index()', () => {
    const found = [];
    for (const f of files) {
      for (const field of offenders(fs.readFileSync(path.join(MODELS, f), 'utf8'))) {
        found.push(`${f}: ${field}`);
      }
    }
    expect(found, 'duplicate index declarations — one of the pair is silently refused').toEqual([]);
  });

  it('detects the shape it is meant to detect', () => {
    // Guarding the guard: the regexes above are the whole test, and a regex
    // that matches nothing passes every file.
    expect(offenders(`
      slug: { type: String, sparse: true },
      schema.index({ slug: 1 }, { unique: true, sparse: true });
    `)).toEqual(['slug']);
  });

  it('leaves compound indexes alone', () => {
    // Visit really does want a path index on sessionId and compound indexes
    // that start with createdAt; those are different key patterns.
    expect(offenders(`
      createdAt: { type: Date, index: true },
      schema.index({ createdAt: 1, sessionId: 1 });
    `)).toEqual([]);
  });
});
