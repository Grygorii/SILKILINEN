// Which reviews lead the homepage carousel.
//
// They were shown newest-first, so the strip was whatever happened to arrive
// last — "Amazing product!!!" next to a review that says the edges are properly
// finished rather than overlocked. For a €168 robe the second one does all the
// work: it is evidence, where the first is only enthusiasm, and a considered
// buyer discounts enthusiasm automatically.
//
// ── The rule that matters most here is what this does NOT do ──
//
// It never reads starRating. Not to sort, not to filter, not to break a tie.
//
// That is a legal constraint, not a stylistic one. The storefront shows every
// approved review at any rating and computes the average from all of them,
// because presenting a favourable subset while displaying an aggregate rating
// falls foul of Google's review-snippet policy and of the EU Omnibus / UK DMCC
// rules on selective presentation. This shop has made that mistake once
// already, by filtering the carousel to 4★+ — which left an average
// mathematically incapable of dropping below 4.0.
//
// Ranking by how SPECIFIC a review is stays on the right side of that line: a
// critical review that describes the fit in detail outranks a five-star
// "Lovely!", and the test suite asserts exactly that. The headline average and
// count still come from /api/reviews/summary over every approved review, so the
// number a customer reads is unaffected by what the carousel chooses to show.

export type CuratableReview = {
  message?: string;
  starRating?: number;
};

// Vocabulary a person only uses when describing the actual object. Grouped so
// the intent survives someone editing the list later — these are the things a
// silk buyer wants corroborated by another buyer, not by us.
const SPECIFIC_TERMS = [
  // construction and finish
  'seam', 'stitch', 'finish', 'hem', 'edge', 'overlock', 'french seam', 'lining', 'button', 'cuff', 'tie', 'strap',
  // fabric and weight
  'momme', 'weight', 'heavy', 'drape', 'breathab', 'cool', 'soft', 'sheen', 'lustre', 'luster', 'mulberry', 'linen', 'silk',
  // fit and sizing
  'size', 'fit', 'length', 'true to', 'petite', 'tall', 'shoulder', 'loose', 'roomy',
  // colour in real conditions
  'colour', 'color', 'shade', 'daylight', 'photo', 'screen', 'depth',
  // ownership over time
  'wash', 'washed', 'care', 'year', 'month', 'still', 'wear', 'worn', 'lasted', 'held up',
  // the unboxing
  'packag', 'wrapped', 'tissue', 'ribbon', 'box', 'gift',
];

// Enthusiasm carries no information. Not penalised on its own — plenty of
// specific reviews open with "Beautiful!" — it simply earns nothing, so a
// review made only of these ranks below one that describes something.
const GENERIC_ONLY = /^[^a-z]*(?:so |very |really |absolutely )?(?:amazing|lovely|beautiful|perfect|gorgeous|stunning|great|good|nice|love it|love this|excellent|fab|wonderful)[\s!.,]*$/i;

/**
 * How much evidence a review contains. Higher is more specific.
 * Deliberately rating-blind — see the header.
 */
export function specificityScore(message?: string): number {
  const text = String(message || '').trim();
  if (!text) return 0;
  if (GENERIC_ONLY.test(text)) return 0;

  const lower = text.toLowerCase();
  // Distinct terms, not occurrences: a review repeating "silk" six times is not
  // six times as informative as one that mentions it once.
  const hits = new Set(SPECIFIC_TERMS.filter(t => lower.includes(t))).size;

  // Length helps, with strongly diminishing returns and a ceiling — an essay is
  // not automatically better evidence than three precise sentences, and without
  // a cap the longest review always wins regardless of content.
  const lengthBonus = Math.min(3, Math.sqrt(text.length) / 8);

  return hits * 2 + lengthBonus;
}

/**
 * Order reviews so the most specific lead, keeping the original order as the
 * tie-break so the result is stable across renders (the source is already
 * newest-first, so equal-scoring reviews stay in date order).
 *
 * @param reviews any approved reviews, in the order the API returned them
 * @param limit   how many to keep
 */
export function curateReviews<T extends CuratableReview>(reviews: T[], limit: number): T[] {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .map((review, index) => ({ review, index, score: specificityScore(review.message) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(r => r.review);
}
