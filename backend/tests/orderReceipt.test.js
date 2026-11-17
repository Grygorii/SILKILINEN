import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { MongoMemoryServer } from 'mongodb-memory-server';

const require = createRequire(import.meta.url);
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { csrf } = require('../middleware/csrf');
const { processReviewRequests } = require('../services/reviewRequests');
const reviewRoutes = require('../routes/reviews');
const adminReviewRoutes = require('../routes/adminReviews');
const orderRoutes = require('../routes/orders');
const { signReceiptToken, signReviewToken } = require('../utils/reviewToken');

const DAY = 86400000;
const nativeFetch = globalThis.fetch;
const sent = [];
let providerStatus = 200;
let mongo;
let server;
let base;
const admin = `token=${jwt.sign({ role: 'admin', userId: '012345678901234567890123' }, process.env.JWT_SECRET)}`;

function post(path, body, cookie = '', method = 'POST') {
  return fetch(base + path, {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(body),
  });
}

function order(overrides = {}) {
  return Order.create({
    status: 'shipped', shippedAt: new Date(Date.now() - 22 * DAY),
    customerEmail: 'buyer@example.test', total: 89, ...overrides,
  });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'order_receipt_tests' });
  await Promise.all([Order.init(), Product.init(), Review.init()]);
  const app = express();
  app.use(express.json(), cookieParser(), csrf);
  app.use('/orders', orderRoutes);
  app.use('/reviews', reviewRoutes);
  app.use('/admin/reviews', adminReviewRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Product.deleteMany({}), Review.deleteMany({})]);
  providerStatus = 200;
  sent.length = 0;
  vi.stubEnv('RESEND_API_KEY', 'fixture-mail-key');
  vi.stubGlobal('fetch', async (url, options) => {
    if (new URL(url).hostname !== 'api.resend.com') return nativeFetch(url, options);
    sent.push({ message: JSON.parse(options.body), key: new Headers(options.headers).get('idempotency-key') });
    const result = providerStatus === 200 ? { id: 'fixture-email' } : { message: 'Fixture send failure' };
    return Response.json(result, { status: providerStatus });
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('delivery check-in', () => {
  it('uses the shipment date and shares one send between the job and admin', async () => {
    const now = new Date();
    const due = await order({ shippedAt: new Date(now - 21 * DAY) });
    await order({ shippedAt: new Date(now - 20 * DAY), createdAt: new Date(now - 40 * DAY) });
    await order({ status: 'paid', shippedAt: undefined, createdAt: new Date(now - 40 * DAY) });
    await order({ status: 'returned' });
    await order({ customerEmail: '   ' });
    await order({ reviewRequestSentAt: new Date(now - DAY) });

    const preview = await post('/admin/reviews/send-pending-requests', { ageDays: 0 }, admin);
    expect(await preview.json()).toMatchObject({ eligible: 1, sent: 0, dryRun: true });
    expect(sent).toHaveLength(0);
    const [scheduled, manual] = await Promise.all([
      processReviewRequests({ now }),
      post('/admin/reviews/send-pending-requests', { dryRun: false, ageDays: 0 }, admin).then(res => res.json()),
    ]);
    expect(scheduled.sent + manual.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.subject).toMatch(/^Has your SILKILINEN order .+ arrived\?$/);
    expect(sent[0].message.html).toContain('Still waiting or need help?');
    expect(sent[0].message.text).toContain('receipt=review#');
    expect(sent[0].key).toBe(`order-receipt/${due._id}`);
    expect((await Order.findById(due._id)).reviewRequestSentAt).toBeInstanceOf(Date);
    expect(await processReviewRequests()).toMatchObject({ eligible: 0, sent: 0, needsReview: 0 });
  });

  it('does not mark a provider error as sent and reuses both links and key on retry', async () => {
    const due = await order();
    providerStatus = 503;
    expect(await processReviewRequests()).toMatchObject({ sent: 0, errors: 1 });
    expect((await Order.findById(due._id)).reviewRequestSentAt).toBeNull();
    await Order.updateOne({ _id: due._id }, { $set: { reviewRequestClaimedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    providerStatus = 200;
    expect(await processReviewRequests()).toMatchObject({ sent: 1 });
    expect(sent[1]).toEqual(sent[0]);
  });

  it('holds a send past the provider’s de-duplication window for review', async () => {
    await order({
      reviewRequestStartedAt: new Date(Date.now() - DAY),
      reviewRequestClaimedAt: new Date(Date.now() - DAY),
    });
    expect(await processReviewRequests()).toMatchObject({ eligible: 0, sent: 0, needsReview: 1 });
    expect(sent).toHaveLength(0);
  });

  it('still sends the dispatch email with tracking and skips the old Delivered email', async () => {
    const paid = await order({ status: 'paid', shippedAt: undefined, trackingUrl: 'https://example.test/track/fixture' });
    const shipped = await post(`/orders/${paid._id}/status`, { status: 'shipped', sendEmail: true }, admin, 'PUT');
    expect(shipped.ok).toBe(true);
    expect(await shipped.json()).toHaveProperty('shippedAt');
    expect(sent[0].message.subject).toContain('is on its way');
    expect(sent[0].message.html).toContain('https://example.test/track/fixture');
    const delivered = await post(`/orders/${paid._id}/status`, { status: 'delivered', sendEmail: true }, admin, 'PUT');
    expect(delivered.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('requires a deliberate receipt action, leaves carrier status alone, and offers verified reviews', async () => {
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    await Product.collection.insertMany(ids.map((_id, i) => ({ _id, name: `Test silk ${i}`, slug: `test-silk-${i}`, status: 'active' })));
    const due = await order({ items: [{ productId: ids[0] }, { includedProducts: [{ productId: ids[1] }] }] });
    await processReviewRequests();
    const link = sent[0].message.text.match(/https?:\/\/[^\s]+receipt=1#[^\s]+/)[0];
    const token = new URL(link).hash.slice(1);
    expect(jwt.decode(token)).not.toHaveProperty('eml');
    expect((await post('/reviews/order-receipt', { token, action: 'check' })).status).toBe(200);
    expect((await Order.findById(due._id)).customerReceivedAt).toBeUndefined();

    const results = await Promise.all([1, 2].map(() => post('/reviews/order-receipt', { token, action: 'confirm' })));
    for (const response of results) expect(response.ok).toBe(true);
    const confirmed = await results[0].json();
    expect(confirmed).toMatchObject({ confirmed: true, items: [expect.anything(), expect.anything()] });
    const saved = await Order.findById(due._id).lean();
    expect(saved.customerReceivedAt).toBeInstanceOf(Date);
    expect(saved.status).toBe('shipped');
    expect(saved.deliveredAt).toBeUndefined();

    const reviewToken = new URL(confirmed.items[0].href, base).searchParams.get('token');
    const review = await post('/reviews/from-token', { token: reviewToken, reviewer: 'Test Buyer', starRating: 4, message: 'Silk test review.' });
    expect(review.status).toBe(201);
    expect(await Review.findOne().lean()).toMatchObject({ verifiedPurchase: true, orderRefId: String(due._id) });
  });

  it('rejects expired, altered and wrong-purpose links and changed order details', async () => {
    const due = await order({ reviewRequestStartedAt: new Date() });
    const valid = signReceiptToken(due);
    const expired = signReceiptToken({ ...due.toObject(), reviewRequestStartedAt: new Date(Date.now() - 91 * DAY) });
    const review = signReviewToken({ orderId: due._id, productId: new mongoose.Types.ObjectId(), customerEmail: due.customerEmail });
    for (const token of [expired, valid + 'invalid', review]) {
      expect((await post('/reviews/order-receipt', { token, action: 'confirm' })).status).toBe(401);
    }
    await Order.updateOne({ _id: due._id }, { $set: { customerEmail: 'different@example.test' } });
    expect((await post('/reviews/order-receipt', { token: valid, action: 'confirm' })).status).toBe(401);
    expect((await Order.findById(due._id)).customerReceivedAt).toBeUndefined();
  });

  it('still accepts review links issued before the delivery check-in', async () => {
    const product = await Product.collection.insertOne({ name: 'Original silk', slug: 'original-silk', status: 'active' });
    const due = await order({ items: [{ productId: product.insertedId }] });
    const token = jwt.sign({
      oid: String(due._id), pid: String(product.insertedId), eml: due.customerEmail,
    }, process.env.JWT_SECRET, { audience: 'silkilinen:write-review', expiresIn: 600 });
    const response = await fetch(base + '/reviews/from-token?token=' + encodeURIComponent(token));
    expect(response.ok).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ product: { name: 'Original silk' }, alreadyReviewed: false });
  });
});
