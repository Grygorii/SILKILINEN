import { describe, it, expect } from 'vitest';

// Mirrors the sort in services/advisor.js. Ranking is the whole value of the
// list: sixteen items sorted only by priority is still a list nobody works
// through, and the digest takes the top three, so what lands in position 1-3
// decides what actually gets done each week.
const ORDER = { high: 0, medium: 1, opportunity: 2, low: 3 };
const URGENCY = { Demand: 0, Conversion: 1 };

const rank = recs => [...recs].sort((a, b) =>
  (ORDER[a.priority] - ORDER[b.priority]) ||
  ((URGENCY[a.category] ?? 9) - (URGENCY[b.category] ?? 9)));

const r = (priority, category, title) => ({ priority, category, title });

describe('advisor ranking', () => {
  it('puts priority first', () => {
    const out = rank([r('low', 'Demand', 'a'), r('high', 'Fixes', 'b')]);
    expect(out.map(x => x.title)).toEqual(['b', 'a']);
  });

  it('within a band, a named cause beats housekeeping', () => {
    const out = rank([
      r('high', 'Fixes', 'missing meta'),
      r('high', 'Demand', 'people waiting'),
      r('high', 'Conversion', 'mobile slipping'),
    ]);
    expect(out.map(x => x.category)).toEqual(['Demand', 'Conversion', 'Fixes']);
  });

  it('never lets a named cause outrank a higher priority band', () => {
    const out = rank([r('medium', 'Demand', 'demand'), r('high', 'Fixes', 'fix')]);
    expect(out[0].title).toBe('fix');
  });

  it('leaves unknown categories last but keeps them', () => {
    const out = rank([r('high', 'Wardrobe', 'x'), r('high', 'Demand', 'y')]);
    expect(out.map(x => x.title)).toEqual(['y', 'x']);
    expect(out).toHaveLength(2);
  });

  it('is stable enough that the digest top-3 is deterministic', () => {
    const recs = [
      r('high', 'Fixes', 'f1'), r('high', 'Demand', 'd1'),
      r('medium', 'Conversion', 'c1'), r('high', 'Conversion', 'c2'),
    ];
    expect(rank(recs).slice(0, 3).map(x => x.title)).toEqual(['d1', 'c2', 'f1']);
  });
});
