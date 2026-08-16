import { describe, it, expect } from 'vitest';
import pkg from '../scripts/reviewBodies.js';
const { GENERAL, PANTIES } = pkg;
const ALL = [...GENERAL, ...PANTIES];

// This is the check the live site failed. "The finish is flawless and it sits
// so elegantly" appeared across SEVEN different reviewers on the homepage,
// because the old seeder recombined a 7-sentence pool into 115 reviews.
const sentences = body => body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);

describe('review bodies', () => {
  it('never repeats a sentence across reviews', () => {
    const seen = new Map();
    for (const r of ALL) for (const s of sentences(r.b)) seen.set(s, (seen.get(s) || 0) + 1);
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('never repeats a whole body or a title', () => {
    expect(new Set(ALL.map(r => r.b)).size).toBe(ALL.length);
    expect(new Set(ALL.map(r => r.t)).size).toBe(ALL.length);
  });

  it('is not a wall of five stars', () => {
    // The storefront now shows every approved review at any rating. All-5★
    // is what reads as bought, so the pool must carry real criticism.
    const below5 = ALL.filter(r => r.r < 5);
    expect(below5.length).toBeGreaterThanOrEqual(ALL.length * 0.2);
    expect(ALL.some(r => r.r === 3)).toBe(true);
  });

  it('gives lower ratings an actual reason', () => {
    // A 3★ with glowing text is less credible than no review at all.
    for (const r of ALL.filter(x => x.r < 5)) {
      expect(r.b.length).toBeGreaterThan(80);
    }
  });

  it('reads as written by people, not assembled', () => {
    // Every body is a couple of real sentences, not a stitched fragment.
    for (const r of ALL) {
      expect(sentences(r.b).length).toBeGreaterThanOrEqual(1);
      expect(r.b.length).toBeGreaterThan(60);
    }
  });
});
