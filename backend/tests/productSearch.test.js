import { describe, it, expect } from 'vitest';

// The search filter is built inline in routes/products.js. This mirrors it so
// the escaping and field coverage are pinned: the escape is what stops operator
// injection ({$ne:...} arriving as q) and a ReDoS against the unindexed
// description field, and the field list is what turns "sky blue" from an empty
// page into a product.
const SEARCH_FIELDS = ['name', 'description', 'category', 'colours', 'colorName', 'sizes', 'materialComposition'];

function buildSearchOr(q) {
  const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return SEARCH_FIELDS.map(f => ({ [f]: { $regex: safe, $options: 'i' } }));
}

describe('product search filter', () => {
  it('covers the fields a shopper actually types', () => {
    expect(buildSearchOr('silk').map(c => Object.keys(c)[0])).toEqual(SEARCH_FIELDS);
  });

  it('coerces a non-string query instead of passing an operator through', () => {
    const or = buildSearchOr({ $ne: '' });
    expect(typeof or[0].name.$regex).toBe('string');
    expect(or[0].name.$regex).not.toContain('$ne');
  });

  it('escapes regex metacharacters so a crafted pattern cannot run', () => {
    expect(buildSearchOr('.*').every(c => Object.values(c)[0].$regex === '\\.\\*')).toBe(true);
  });

  it('leaves ordinary words untouched', () => {
    expect(buildSearchOr('sky blue')[0].name.$regex).toBe('sky blue');
  });

  it('is case-insensitive on every field', () => {
    expect(buildSearchOr('x').every(c => Object.values(c)[0].$options === 'i')).toBe(true);
  });
});
