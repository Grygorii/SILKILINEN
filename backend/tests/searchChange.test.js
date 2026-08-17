import { describe, it, expect } from 'vitest';
import pkg from '../services/searchConsole.js';

// The SEO overview showed four numbers with nothing to compare them against.
// "718 impressions" is unreadable on its own: 718 after 300 and 718 after 1200
// are opposite situations, and the panel rendered them identically.
//
// Position is the trap. Lower is better for it and worse for everything else,
// and that asymmetry is what gets inverted in a template and then quietly lies
// on a dashboard — so `better` is computed once, here, and is the only thing a
// caller should colour on.
const { describeChange } = pkg;

describe('period-over-period change', () => {
  it('counts up is better', () => {
    const c = describeChange(718, 300);
    expect(c.delta).toBe(418);
    expect(c.pct).toBe(139);
    expect(c.better).toBe(true);
  });

  it('counts down is worse', () => {
    const c = describeChange(300, 718);
    expect(c.better).toBe(false);
    expect(c.pct).toBeLessThan(0);
  });

  it('position moving DOWN the page number is better', () => {
    // 19 → 15.5 is a real improvement, and the naive reading calls it a fall.
    const c = describeChange(15.5, 19, { metric: 'position' });
    expect(c.delta).toBe(-3.5);
    expect(c.better).toBe(true);
  });

  it('position moving UP the page number is worse', () => {
    const c = describeChange(19, 15.5, { metric: 'position' });
    expect(c.better).toBe(false);
  });

  it('marks a small move as flat rather than reporting noise as a trend', () => {
    expect(describeChange(103, 100).flat).toBe(true);
    expect(describeChange(140, 100).flat).toBe(false);
  });

  it('says nothing when there is no baseline to compare against', () => {
    // A first-ever window has no previous period. Reporting "+100%" against zero
    // would be arithmetic, not information.
    expect(describeChange(718, 0)).toBeNull();
    expect(describeChange(718, null)).toBeNull();
    expect(describeChange(718, undefined)).toBeNull();
    // A missing CURRENT figure must not read as a 100% collapse: Number(null)
    // is 0, so this is the coercion that would have announced total loss.
    expect(describeChange(null, 300)).toBeNull();
    expect(describeChange(undefined, 300)).toBeNull();
  });

  it('handles a fractional CTR without rounding it away', () => {
    // CTR arrives as a fraction (0.017 = 1.7%), so the delta must survive it.
    const c = describeChange(0.017, 0.04);
    expect(c.better).toBe(false);
    // -57.5%, and Math.round takes a negative half toward zero.
    expect(c.pct).toBe(-57);
  });
});
