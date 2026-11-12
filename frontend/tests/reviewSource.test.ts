import { describe, expect, it } from 'vitest';
import { reviewSourceLabel } from '../lib/reviewSource';
describe('review provenance', () => {
  it('labels Etsy imports without claiming a new website purchase',()=>expect(reviewSourceLabel({source:'etsy'})).toBe('From our Etsy shop'));
  it('requires order provenance and verification for a verified website label',()=>expect(reviewSourceLabel({source:'order',verifiedPurchase:true})).toBe('Verified website purchase'));
  it('does not transform a site submission into a verified Etsy buyer',()=>expect(reviewSourceLabel({source:'site',verifiedPurchase:true})).toBe('Website review'));
  it('does not invent provenance for a legacy or seeded row',()=>{expect(reviewSourceLabel({source:'seed',verifiedPurchase:true})).toBe('');expect(reviewSourceLabel({})).toBe('');});
});
