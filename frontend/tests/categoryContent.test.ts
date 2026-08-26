import { describe, it, expect } from 'vitest';
import { CATEGORY_CONTENT, categoryContent, GUIDE_LINKS } from '@/lib/categoryContent';

// The canonical six (backend/config/categories.js). Stated here rather than
// imported because the frontend cannot reach the backend module, which is
// precisely the gap that let the copy drift out of step in the first place.
const CANONICAL = ['robes', 'sleepwear', 'lingerie', 'lounge', 'home', 'scarves'];

// The bug this file replaces: the route's CATEGORY_COPY had seven entries, four
// of them for retired slugs that 301 away, while three LIVE categories had no
// introduction at all. Nine categories were merged into six and the copy stayed
// keyed on the old nine. Prose has no foreign key — this is the foreign key.
describe('category content', () => {
  it('covers every live category', () => {
    for (const slug of CANONICAL) {
      expect(categoryContent(slug), slug).not.toBeNull();
    }
  });

  it('has no entry for a category that no longer exists', () => {
    // Copy for a 301'd slug can never render, and its presence makes the map
    // look current when it is not.
    for (const retired of ['pyjamas', 'shorts', 'shirts', 'pillowcases', 'sleep-dresses', 'eye-masks']) {
      expect(categoryContent(retired), retired).toBeNull();
    }
    expect(Object.keys(CATEGORY_CONTENT).sort()).toEqual([...CANONICAL].sort());
  });

  it('gives every category both halves — an intro and a guide', () => {
    for (const slug of CANONICAL) {
      const c = categoryContent(slug)!;
      expect(c.intro.length, slug).toBeGreaterThan(20);
      expect(c.guide.body.length, slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the intro short and the guide substantial', () => {
    for (const slug of CANONICAL) {
      const c = categoryContent(slug)!;
      // §21: a short introduction above the grid, not a wall of SEO text.
      expect(c.intro.length, `${slug} intro`).toBeLessThan(140);
      // …and genuinely useful content below it.
      const words = c.guide.body.join(' ').split(/\s+/).length;
      expect(words, `${slug} guide`).toBeGreaterThan(120);
    }
  });

  // The rule the Silk Standard page exists to protect, applied one level up.
  it('never asserts a momme weight for a whole shelf', () => {
    for (const slug of CANONICAL) {
      const c = categoryContent(slug)!;
      const all = `${c.intro} ${c.guide.body.join(' ')}`;
      expect(all, slug).not.toMatch(/\b\d+\s*(?:mm\b|momme)/i);
    }
  });

  it('sends every category to the same three education pages', () => {
    // §68: the education pages accumulate links rather than each category
    // inventing its own trail.
    expect(GUIDE_LINKS.map(l => l.href)).toEqual(['/silk-standard', '/care-guide', '/journal']);
  });

  it('is tolerant of the stored value, which is a free-text string', () => {
    expect(categoryContent(' Robes ')).not.toBeNull();
    expect(categoryContent('')).toBeNull();
    expect(categoryContent(null)).toBeNull();
  });
});
