/** Provenance and purchase verification are different facts. Never infer Etsy from a generic verified flag. */
export function reviewSourceLabel(review: { source?: string; verifiedPurchase?: boolean }): string {
  if (review.source === 'etsy') return 'From our Etsy shop';
  if (review.source === 'order' && review.verifiedPurchase) return 'Verified website purchase';
  if (review.source === 'site' || review.source === 'order') return 'Website review';
  return '';
}
