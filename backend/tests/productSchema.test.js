import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';

// Source is CJS; require it from ESM via createRequire.
const require = createRequire(import.meta.url);
const Product = require('../models/Product.js');

let mongod;

beforeAll(async () => {
  // Pin to a Mongo version with prebuilt binaries on all supported Ubuntu
  // images. mongodb-memory-server's auto-selected version sometimes picks a
  // build that doesn't exist for the current platform (e.g. ubuntu2404 +
  // mongo 8.2.x). 7.0.x covers everything we use.
  mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Product schema F11 constraints', () => {
  it('rejects an empty product name', async () => {
    const p = new Product({ name: '', price: 10 });
    await expect(p.validate()).rejects.toThrow(/name/i);
  });

  it('rejects a whitespace-only product name', async () => {
    const p = new Product({ name: '   ', price: 10 });
    await expect(p.validate()).rejects.toThrow(/empty/i);
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
