import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

describe('public review and product rating visibility', () => {
  it('excludes seeded reviews from every public approved-review query', () => {
    for (const file of ['reviews.js', 'products.js']) {
      const code = fs.readFileSync(path.join(__dirname, '../routes', file), 'utf8');
      const matches = [...code.matchAll(/status: 'approved'/g)];
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) expect(code.slice(m.index, m.index + 70)).toContain("source: { $ne: 'seed' }");
    }
  });
  it('keeps server-cart lookup separate from the new analytics identifier', () => {
    const code=fs.readFileSync(path.join(__dirname,'../routes/checkoutV2.js'),'utf8');
    expect(code).toContain('sessionId ? Cart.findOne({ sessionId })');
    expect(code).toContain('Visit.findOne({ sessionId: browserSessionId })');
    expect(code).toContain('Visit.updateMany({ sessionId: browserSessionId }');
    expect(code).toContain('.maxTimeMS(1500).lean().catch(() => null)');
    expect(code).not.toContain('Cart.findOne({ sessionId: browserSessionId })');
  });
});
