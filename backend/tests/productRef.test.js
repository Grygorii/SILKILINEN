import { describe, it, expect } from 'vitest';
import pkg from '../utils/productRef.js';
import slugPkg from '../utils/slug.js';

// Hermes records which product a play is about by NAME, then the plan is read
// back weeks later. scripts/renameProducts.js rewrote every name in the catalogue
// in one pass, so every play written before it reported "couldn't match a product
// named …" while the product sat there under its new name — four of five items in
// one plan, including one that was a duplicate of an item that DID match.
//
// The resolution ORDER is the whole behaviour, so the model is injected and these
// pin the order rather than the database.
const { findProductByRef } = pkg;
const { slugify } = slugPkg;

// A catalogue as it stands AFTER the rename. previousSlugs is the 301 trail
// Product.pre('save') keeps, slugified from each product's former name.
const CATALOGUE = [
  {
    _id: '65f0a1b2c3d4e5f6a7b8c9d1', name: 'Silk bikini briefs in Onyx Black',
    slug: 'silk-bikini-briefs-in-onyx-black',
    previousSlugs: [slugify('Onyx Black Silk Bikini Brief')],
    status: 'active', totalStock: 9,
  },
  {
    _id: '65f0a1b2c3d4e5f6a7b8c9d2', name: 'Silk pillowcase in Sage Green',
    slug: 'silk-pillowcase-in-sage-green',
    previousSlugs: [slugify('Silkilinen Sage green silk pillowcase')],
    status: 'active', totalStock: 7,
  },
];

// Just enough of the Mongoose surface the resolver uses.
function fakeModel(docs = CATALOGUE, calls = []) {
  const wrap = doc => ({ select: () => ({ lean: async () => doc || null }) });
  const matches = (filter, d) => {
    if (filter.name instanceof RegExp) return filter.name.test(d.name);
    if (filter.$or) {
      return filter.$or.some(c => (c.slug !== undefined
        ? d.slug === c.slug
        : (d.previousSlugs || []).includes(c.previousSlugs)));
    }
    return false;
  };
  return {
    calls,
    findById: id => { calls.push('id'); return wrap(docs.find(d => d._id === id)); },
    findOne: f => {
      calls.push(f.name instanceof RegExp ? 'name' : 'slug');
      return wrap(docs.find(d => matches(f, d)));
    },
  };
}

describe('resolving a product reference', () => {
  it('matches the current name', async () => {
    const hit = await findProductByRef('Silk pillowcase in Sage Green', null, fakeModel());
    expect(hit.name).toBe('Silk pillowcase in Sage Green');
    expect(hit.matchedVia).toBe('name');
  });

  it('is case-insensitive on the name', async () => {
    const hit = await findProductByRef('silk PILLOWCASE in sage green', null, fakeModel());
    expect(hit?._id).toBe('65f0a1b2c3d4e5f6a7b8c9d2');
  });

  // The actual failures from the plan panel.
  it('follows the rename trail for a name from before the catalogue was renamed', async () => {
    const cases = [
      ['Onyx Black Silk Bikini Brief', 'Silk bikini briefs in Onyx Black'],
      ['Silkilinen Sage green silk pillowcase', 'Silk pillowcase in Sage Green'],
    ];
    for (const [oldName, currentName] of cases) {
      const hit = await findProductByRef(oldName, null, fakeModel());
      expect(hit, `should resolve ${oldName}`).toBeTruthy();
      expect(hit.name).toBe(currentName);
      expect(hit.matchedVia).toBe('slug');
    }
  });

  it('prefers a recorded id, and does not even look at the name', async () => {
    // A play written after this fix carries the id, so a later rename cannot
    // break it. The name here is deliberately wrong to prove the id won.
    const model = fakeModel();
    const hit = await findProductByRef('a name that matches nothing', '65f0a1b2c3d4e5f6a7b8c9d1', model);
    expect(hit.matchedVia).toBe('id');
    expect(model.calls).toEqual(['id']);
  });

  it('falls through to the name when the recorded id no longer exists', async () => {
    // A deleted-then-recreated product must not become permanently unresolvable.
    const hit = await findProductByRef('Silk pillowcase in Sage Green', '65f0a1b2c3d4e5f6a7b8c9ff', fakeModel());
    expect(hit?._id).toBe('65f0a1b2c3d4e5f6a7b8c9d2');
  });

  it('ignores a malformed id without spending a query on it', async () => {
    const model = fakeModel();
    await findProductByRef('Silk pillowcase in Sage Green', 'not-an-objectid', model);
    expect(model.calls).not.toContain('id');
  });

  it('returns null rather than guessing at a product it cannot find', async () => {
    // The caller rewrites this product's meta, so a wrong match silently edits
    // the SEO of a page nobody asked about. Unmatched must stay unmatched.
    expect(await findProductByRef('Cashmere scarf we never sold', null, fakeModel())).toBeNull();
    expect(await findProductByRef('', null, fakeModel())).toBeNull();
    expect(await findProductByRef(null, null, fakeModel())).toBeNull();
  });

  it('does not match a different product that merely shares words', async () => {
    // "Silk pillowcase in Sage Green" and a hypothetical sibling differ only by
    // colour; a fuzzy resolver would happily confuse them.
    const model = fakeModel([
      ...CATALOGUE,
      { _id: '65f0a1b2c3d4e5f6a7b8c9d3', name: 'Silk pillowcase in Ivory', slug: 'silk-pillowcase-in-ivory', previousSlugs: [] },
    ]);
    const hit = await findProductByRef('Silk pillowcase', null, model);
    expect(hit).toBeNull();
  });

  it('survives a database error by returning null, not by throwing', async () => {
    const broken = {
      findById: () => ({ select: () => ({ lean: async () => { throw new Error('db down'); } }) }),
      findOne: () => ({ select: () => ({ lean: async () => { throw new Error('db down'); } }) }),
    };
    await expect(findProductByRef('anything', '65f0a1b2c3d4e5f6a7b8c9d1', broken)).resolves.toBeNull();
  });
});
