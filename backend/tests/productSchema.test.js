import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { createRequire } from 'module';

// Source is CJS; require it from ESM via createRequire.
const require = createRequire(import.meta.url);
const Product = require('../models/Product.js');
const { tryStartMongo } = require('./mongo.js');

// Resolved before the suite is declared so an unavailable binary SKIPS these
// rather than failing them — see tests/mongo.js for why that distinction matters.
const mongo = await tryStartMongo();

describe.skipIf(!mongo)('Product schema F11 constraints', () => {
  // Hooks live INSIDE the suite: a top-level beforeAll still runs when every
  // test in the file is skipped, and would then dereference a null mongo.
  beforeAll(async () => {
    await mongoose.connect(mongo.uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('rejects an empty product name', async () => {
    const p = new Product({ name: '', price: 10 });
    await expect(p.validate()).rejects.toThrow(/name/i);
  });

  it('rejects a whitespace-only product name', async () => {
    const p = new Product({ name: '   ', price: 10 });
    // The behaviour is right — whitespace is rejected — but NOT via the schema's
    // "Product name cannot be empty" validator, which is what this used to
    // assert. `trim: true` is a setter, so '   ' becomes '' before validation
    // runs and `required` fires first with its own message. The custom validator
    // is unreachable for this input. Assert what actually happens.
    await expect(p.validate()).rejects.toThrow(/name is required/i);
  });

  it('rejects a missing price', async () => {
    const p = new Product({ name: 'Linen Slip' });
    await expect(p.validate()).rejects.toThrow(/price/i);
  });

  it('rejects a negative price', async () => {
    const p = new Product({ name: 'Linen Slip', price: -5 });
    await expect(p.validate()).rejects.toThrow(/negative/i);
  });

  it('accepts a valid draft product', async () => {
    const p = new Product({ name: 'Linen Slip', price: 89, status: 'draft' });
    await expect(p.validate()).resolves.toBeUndefined();
  });

  it('accepts a price of 0 (for early-draft products without pricing yet)', async () => {
    // validateForPublish in routes/adminProducts still blocks publishing
    // a zero-price product. Schema only enforces non-negative.
    const p = new Product({ name: 'Linen Slip', price: 0, status: 'draft' });
    await expect(p.validate()).resolves.toBeUndefined();
  });
});
