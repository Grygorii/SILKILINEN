import { describe, it, expect } from 'vitest';
import { curateReviews, specificityScore } from '@/lib/reviewCuration';

const r = (message: string, starRating = 5) => ({ message, starRating });

// The headline assertion. Curating a review carousel is one step away from
// selective presentation, which is a regulatory problem (Google's review-snippet
// policy, EU Omnibus, UK DMCC) and one this shop has already committed once by
// filtering the strip to 4★+.
//
// Ranking by SPECIFICITY is the version that stays legitimate — but only if the
// rating genuinely plays no part, which is what these tests exist to hold.
describe('rating-blindness', () => {
  it('ranks a critical, specific review above a glowing, empty one', () => {
    const out = curateReviews([
      r('Amazing!!!', 5),
      r('The silk is lovely but it runs large through the shoulder — I sized down and the drape is much better.', 2),
    ], 2);
    expect(out[0].starRating).toBe(2);
  });

  it('gives identical text the identical score at any rating', () => {
    const text = 'The seams are properly finished and the colour has real depth in daylight.';
    expect(specificityScore(text)).toBe(specificityScore(text));
    const out = curateReviews([r(text, 1), r(text, 5)], 2);
    // Equal scores fall back to source order, not to the better rating.
    expect(out.map(x => x.starRating)).toEqual([1, 5]);
  });

  it('does not quietly drop one-star reviews from the pool', () => {
    const out = curateReviews([
      r('Beautiful', 5),
      r('Gorgeous', 5),
      r('Arrived with a pulled thread near the hem and the shade is greyer than the photo.', 1),
    ], 1);
    expect(out).toHaveLength(1);
    expect(out[0].starRating).toBe(1);
  });
});

describe('specificity', () => {
  it('scores an evidence-free review at zero', () => {
    for (const m of ['Amazing!!!', 'Lovely', 'so beautiful', 'Perfect.', 'LOVE IT', '']) {
      expect(specificityScore(m), m).toBe(0);
    }
  });

  it('rewards concrete detail', () => {
    const specific = specificityScore('The edges are properly finished rather than overlocked, and at 22 momme it hangs beautifully.');
    const vague = specificityScore('Really nice quality, very happy with my purchase and would buy again.');
    expect(specific).toBeGreaterThan(vague);
  });

  it('counts distinct details, not repetition', () => {
    const repeated = specificityScore('silk silk silk silk silk silk silk silk');
    const varied = specificityScore('The silk drapes well and the seams are neat.');
    expect(varied).toBeGreaterThan(repeated);
  });

  it('caps the reward for length so an essay cannot buy the top slot', () => {
    // No specific terms at all, just a lot of words.
    const rambling = specificityScore('I ordered this and then waited and then it came and then '.repeat(20));
    const short = specificityScore('Lovely sheen, and the shoulder seams sit exactly right.');
    expect(short).toBeGreaterThan(rambling);
  });

  it('does not punish a review for opening with enthusiasm', () => {
    // GENERIC_ONLY must match the whole message, not appear within it.
    expect(specificityScore('Beautiful! The french seams are immaculate.')).toBeGreaterThan(0);
  });
});

describe('ordering', () => {
  it('is stable — equal scores keep the source order (newest first)', () => {
    const a = r('Amazing');
    const b = r('Lovely');
    const c = r('Perfect');
    expect(curateReviews([a, b, c], 3)).toEqual([a, b, c]);
  });

  it('respects the limit and survives junk input', () => {
    expect(curateReviews([r('a'), r('b'), r('c')], 2)).toHaveLength(2);
    expect(curateReviews([], 5)).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(curateReviews(null as any, 5)).toEqual([]);
    expect(curateReviews([{ starRating: 5 }], 5)).toHaveLength(1);
  });
});
