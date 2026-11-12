import { describe, it, expect } from 'vitest';
import pkg from '../utils/colourFamilies.js';
const { fallbackColourSlugs, BOXER_COLOURS }=pkg;
describe('curated boxer colour navigation',()=>{
  it('links each known colour to the other two without self-links',()=>{
    for(const slug of BOXER_COLOURS){const siblings=fallbackColourSlugs({slug});expect(siblings).toHaveLength(2);expect(siblings).not.toContain(slug);}
  });
  it('does not replace explicit admin relationships',()=>expect(fallbackColourSlugs({slug:BOXER_COLOURS[0],colorVariants:[{productId:'curated'}]})).toEqual([]));
  it('does not group unrelated or guessed products',()=>expect(fallbackColourSlugs({slug:'new-boxer-design'})).toEqual([]));
});
