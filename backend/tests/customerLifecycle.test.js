import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Segment = require('../models/Segment');
const Cart = require('../models/Cart');
const Newsletter = require('../models/Newsletter');
const StockNotification = require('../models/StockNotification');
const Product = require('../models/Product');
const PromoCode = require('../models/PromoCode');
const WishlistInterest = require('../models/WishlistInterest');
const { syncOrderCustomer, syncAfterOrderChange, reconcileCustomerOrders } = require('../services/customerOrders');
const { customerOrderStats } = require('../utils/customerOrderStats');
const { eraseCustomer } = require('../services/customerErasure');
const { recomputeAll } = require('../services/segments');
const {
  recordWishlistSaves,
  markWishlistRemoved,
  getActiveWishlistOffer,
  getEligibleWishlistReminders,
  revalidateClaimedWishlistReminder,
  processWishlistReminders,
} = require('../services/wishlistReminders');
const { saveSiteSettings } = require('../services/siteSettings');
const { sign: signUnsubscribe } = require('../utils/unsubscribeSign');
const emails = require('../services/email');
const welcome = vi.spyOn(emails, 'sendWelcome').mockRejectedValue(new Error('fixture mail outage'));
const magic = vi.spyOn(emails, 'sendMagicLink').mockResolvedValue(true);
const processing = vi.spyOn(emails, 'sendProcessingEmail').mockResolvedValue(true);
const shipped = vi.spyOn(emails, 'sendShippedEmail').mockResolvedValue(true);
const google = require('google-auth-library');
const verifyGoogle = vi.spyOn(google.OAuth2Client.prototype, 'verifyIdToken');
const customersRouter = require('../routes/customers');
const newsletterRouter = require('../routes/newsletter');
const adminRouter = require('../routes/adminCustomers');
const adminWishlistRouter = require('../routes/adminWishlist');
const ordersRouter = require('../routes/orders');
const productsRouter = require('../routes/products');
const { csrf } = require('../middleware/csrf');
let mongo, server, base;
const adminCookie = `token=${jwt.sign({ role: 'admin', userId: '012345678901234567890123' }, process.env.JWT_SECRET)}`;
const customerCookie = id => `customer_token=${jwt.sign({ customerId: String(id) }, process.env.JWT_CUSTOMER_SECRET)}`;
const request = (path, { cookie = adminCookie, method = 'GET', body } = {}) => fetch(base + path, {
  method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const makeOrder = (patch = {}) => Order.create({ customerEmail: 'buyer@example.test', customerName: 'Buyer Example',
  status: 'paid', total: 100, items: [{ name: 'Silk', price: 100, quantity: 1 }], ...patch });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'customer_lifecycle_tests' });
  await Promise.all([Customer, Order, Segment, Cart, Newsletter, StockNotification, Product, PromoCode, WishlistInterest].map(m => m.init()));
  const app = express(); app.use(express.json()); app.use(cookieParser()); app.use(csrf);
  app.use('/api/customers', customersRouter); app.use('/api/newsletter', newsletterRouter); app.use('/api/admin/customers', adminRouter); app.use('/api/admin/wishlist', adminWishlistRouter); app.use('/api/orders', ordersRouter); app.use('/api/products', productsRouter);
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
afterAll(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongo) await mongo.stop(); vi.restoreAllMocks(); });
beforeEach(async () => { await Promise.all([Customer, Order, Segment, Cart, Newsletter, StockNotification, Product, PromoCode, WishlistInterest].map(m => m.deleteMany({}))); vi.clearAllMocks(); });

describe('guest orders → customer profile → admin list and detail', () => {
  it('repairs an absent guest once, normalizes identity, preserves guest checkout and never opts them into marketing', async () => {
    const one = await makeOrder({ customerEmail: ' Buyer@Example.Test ' });
    await makeOrder({ status: 'shipped', total: 40 });
    await makeOrder({ status: 'cancelled', total: 800 });
    await syncOrderCustomer(one._id); await syncOrderCustomer(one._id);
    expect(await Customer.countDocuments()).toBe(1);
    const c = await Customer.findOne().lean();
    expect(c).toMatchObject({ email: 'buyer@example.test', profileSource: 'order', emailVerified: false, marketingConsent: false, orderCount: 2, totalSpend: 140 });
    expect(await Order.countDocuments({ customerId: c._id })).toBe(3);
    expect(welcome).not.toHaveBeenCalled(); expect(magic).not.toHaveBeenCalled();
    const list = await (await request('/api/admin/customers')).json();
    expect(list.total).toBe(1); expect(list.customers[0].orderCount).toBe(2);
    const detail = await (await request(`/api/admin/customers/${c._id}`)).json();
    expect(detail.totalSpend).toBe(140); expect(detail.orders).toHaveLength(3);
    expect((await request('/api/customers/me', { cookie: customerCookie(c._id) })).status).toBe(401);
  });
  it('does not replace an existing profile, login credentials or consent with a delivery recipient', async () => {
    const c = await Customer.create({ email: 'buyer@example.test', firstName: 'Account Owner', marketingConsent: true, emailVerified: true, googleId: 'existing-google' });
    const o = await makeOrder({ customerName: 'Gift Recipient' }); await syncOrderCustomer(o._id);
    expect(await Customer.findById(c._id).lean()).toMatchObject({ firstName: 'Account Owner', googleId: 'existing-google', marketingConsent: true, emailVerified: true, orderCount: 1 });
  });
  it('recomputes net EUR spend after a partial refund without removing purchase history', async () => {
    const one = await makeOrder({ total: 100, displayCurrency: 'GBP', chargedTotal: 85 });
    await syncOrderCustomer(one._id);
    await Order.updateOne({ _id: one._id }, { $set: { status: 'partially_refunded', refundedAmount: 20, customerSyncPending: true } });
    await syncOrderCustomer(one._id);
    expect(await Customer.findOne().lean()).toMatchObject({ orderCount: 1, totalSpend: 80 });
    await Order.updateOne({ _id: one._id }, { $set: { status: 'refunded', refundedAmount: 100 } });
    await syncOrderCustomer(one._id);
    expect(await Customer.findOne().lean()).toMatchObject({ orderCount: 1, totalSpend: 0 });
  });
  it('never invents identities for missing email or creates contacts from failed payments', async () => {
    const missing = await makeOrder({ customerEmail: undefined });
    const failed = await makeOrder({ status: 'failed' });
    expect((await syncOrderCustomer(missing._id)).status).toBe('missing_email');
    expect((await syncOrderCustomer(failed._id)).status).toBe('not_a_purchase');
    expect(await Customer.countDocuments()).toBe(0);
  });
  it('serializes concurrent updates for an existing customer and does not double-count retries', async () => {
    await Customer.create({ email: 'buyer@example.test' });
    const orders = await Promise.all([makeOrder({ total: 10 }), makeOrder({ total: 20 })]);
    await Promise.all(orders.map(o => syncOrderCustomer(o._id)));
    expect(await Customer.findOne().lean()).toMatchObject({ orderCount: 2, totalSpend: 30 });
  });
  it('handles two simultaneous first purchases without duplicate guest profiles', async () => {
    const orders = await Promise.all([makeOrder({ total: 30 }), makeOrder({ total: 50 })]);
    await Promise.all(orders.map(o => syncOrderCustomer(o._id)));
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Customer.findOne().lean()).toMatchObject({ orderCount: 2, totalSpend: 80 });
  });
  it('reports an explicit customer/email conflict rather than silently moving an order', async () => {
    const other = await Customer.create({ email: 'other@example.test' });
    const order = await makeOrder({ customerId: other._id });
    expect((await syncOrderCustomer(order._id)).status).toBe('invalid_customer_link');
    expect(String((await Order.findById(order._id)).customerId)).toBe(String(other._id));
  });
  it('keeps a dry run read-only and provides bounded unresolved diagnostics', async () => {
    await makeOrder(); await makeOrder({ customerEmail: '' });
    const preview = await reconcileCustomerOrders({ dryRun: true });
    expect(preview.scanned).toBe(2); expect(await Customer.countDocuments()).toBe(0);
    const result = await reconcileCustomerOrders();
    expect(result).toMatchObject({ created: 1, synced: 1, skipped: 1, failed: 0, remaining: 0, unresolved: 1 });
  });
  it('uses paid dates, not cancelled attempts, for first and last orders', () => {
    const data = customerOrderStats([{ status: 'failed', createdAt: '2020-01-01', total: 50 }, { status: 'shipped', createdAt: '2026-01-02', total: 10 }, { status: 'cancelled', createdAt: '2026-12-01', total: 80 }]);
    expect(data).toEqual({ orderCount: 1, totalSpend: 10, firstOrderAt: '2026-01-02', lastOrderAt: '2026-01-02' });
  });
});
describe('response boundaries and real HTTP contracts', () => {
  it('keeps authentication material out of admin list, detail, and update responses', async () => {
    const c = await Customer.create({ email: 'buyer@example.test', passwordHash: 'private-hash', emailVerificationToken: 'private-token', passwordResetToken: 'private-reset' });
    for (const [path, options] of [[`/api/admin/customers`, {}], [`/api/admin/customers/${c._id}`, {}], [`/api/admin/customers/${c._id}`, { method: 'PUT', body: { firstName: 'Edited' } }]]) {
      const response = await request(path, options); expect(response.status).toBe(200);
      const data = await response.text(); expect(data).not.toMatch(/private-hash|private-token|private-reset|passwordHash|emailVerificationToken/);
    }
  });
  it('returns exports through GET and excludes non-consenting guest profiles', async () => {
    await Customer.create({ email: 'opted-in@example.test', marketingConsent: true });
    const guest = await Customer.create({ email: 'guest@example.test', marketingConsent: false });
    const productId = new mongoose.Types.ObjectId();
    await Customer.updateOne({ _id: guest._id }, { $addToSet: { wishlist: productId } });
    await WishlistInterest.create({
      customerId: guest._id,
      productId,
      savedAt: new Date('2026-01-01'),
      reminderAttemptedAt: new Date('2026-01-08'),
    });
    const csv = await request('/api/admin/customers/export/csv'); expect(csv.status).toBe(200);
    const body = await csv.text(); expect(body).toContain('opted-in@example.test'); expect(body).not.toContain('guest@example.test');
    const exportResponse = await request(`/api/admin/customers/${guest._id}/gdpr-export`);
    expect(exportResponse.status).toBe(200);
    const data = await exportResponse.json();
    expect(data.customer.wishlist.map(String)).toContain(String(productId));
    expect(data.wishlistReminderHistory).toEqual([expect.objectContaining({ productId: expect.any(String), reminderAttemptedAt: expect.any(String) })]);
  });
  it('honors a signed one-click unsubscribe POST without a CSRF header', async () => {
    const customer = await Customer.create({ email: 'opt-out@example.test', marketingConsent: true });
    await Newsletter.create({ email: customer.email, customerId: customer._id, isUnsubscribed: false });
    const cid = Buffer.from(String(customer._id)).toString('base64url');
    const sig = signUnsubscribe(customer._id, 'customer');

    const response = await fetch(`${base}/api/customers/unsubscribe?cid=${cid}&sig=${sig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Unsubscribed');
    expect(await Customer.findById(customer._id).lean()).toMatchObject({ marketingConsent: false });
    expect(await Newsletter.findOne({ email: customer.email }).lean()).toMatchObject({ isUnsubscribed: true });
  });
  it('makes a normal newsletter unsubscribe remove wishlist marketing permission', async () => {
    const now = new Date();
    const customer = await Customer.create({ email: 'newsletter-opt-out@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Newsletter silk', slug: 'newsletter-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 8 * 86400000) });
    const subscription = await Newsletter.create({ email: customer.email, customerId: customer._id, isUnsubscribed: false });

    expect(await getEligibleWishlistReminders({ now })).toHaveLength(1);
    const response = await fetch(`${base}/api/newsletter/unsubscribe/${subscription.unsubscribeToken}`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(await Customer.findById(customer._id).lean()).toMatchObject({ marketingConsent: false });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
  });
  it('synchronizes an account marketing opt-out to newsletter delivery', async () => {
    const customer = await Customer.create({ email: 'profile-opt-out@example.test', emailVerified: true, marketingConsent: true });
    await Newsletter.create({ email: customer.email, customerId: customer._id, isUnsubscribed: false });

    const response = await request('/api/customers/me', {
      cookie: customerCookie(customer._id), method: 'PUT', body: { marketingConsent: false },
    });
    expect(response.status).toBe(200);
    expect(await Newsletter.findOne({ email: customer.email }).lean()).toMatchObject({ isUnsubscribed: true });
  });
  it('validates profile writes, safely escapes search and bounds pagination', async () => {
    expect((await request('/api/admin/customers/not-an-id')).status).toBe(400);
    expect((await request('/api/admin/customers', { method: 'POST', body: { email: { $ne: null } } })).status).toBe(400);
    expect((await request('/api/admin/customers', { method: 'POST', body: { email: 'a@example.test', marketingConsent: 'false' } })).status).toBe(400);
    const response = await request('/api/admin/customers?limit=-5&search=%5Ba'); expect(response.status).toBe(200);
  });
  it('does not expose internal financial/audit fields to a verified buyer and enforces ownership', async () => {
    const c = await Customer.create({ email: 'buyer@example.test', emailVerified: true });
    const foreign = await Customer.create({ email: 'other@example.test', emailVerified: true });
    const order = await makeOrder({ customerId: c._id, internalNote: 'private-note', costs: { cogs: 3 }, browserSessionId: 'private-browser', statusHistory: [{ status: 'paid', note: 'private-history', changedBy: foreign._id }] });
    const cookie = customerCookie(c._id);
    for (const path of ['/api/customers/me/orders', `/api/customers/me/orders/${order._id}`]) {
      const response = await request(path, { cookie }); expect(response.status).toBe(200);
      expect(await response.text()).not.toMatch(/private-note|private-history|private-browser|cogs|changedBy|customerSync/);
    }
    expect((await request(`/api/customers/me/orders/${order._id}`, { cookie: customerCookie(foreign._id) })).status).toBe(404);
  });
  it('consumes a magic link once; a welcome-email outage does not invalidate successful sign-in', async () => {
    await Customer.create({ email: 'buyer@example.test', emailVerificationToken: 'fixture-token', emailVerificationExpiry: new Date(Date.now() + 60000) });
    const attempts = await Promise.all([1,2].map(() => request('/api/customers/verify-magic-link', { cookie: '', method: 'POST', body: { token: 'fixture-token' } })));
    expect(attempts.map(r => r.status).sort()).toEqual([200,410]);
    expect(attempts.find(r => r.status === 200).headers.get('set-cookie')).toContain('customer_token=');
  });
  it('verifies an existing guest profile on a valid Google login without duplicating it', async () => {
    process.env.GOOGLE_CLIENT_ID = 'fixture-client';
    const c = await Customer.create({ email: 'buyer@gmail.com', profileSource: 'order', emailVerified: false });
    verifyGoogle.mockResolvedValue({ getPayload: () => ({ sub: 'fixture-google-sub', email: 'buyer@gmail.com', email_verified: true, given_name: 'Buyer' }) });
    const response = await request('/api/customers/google', { cookie: '', method: 'POST', body: { credential: 'fixture-credential' } });
    expect(response.status).toBe(200); expect(await Customer.countDocuments()).toBe(1);
    expect(await Customer.findById(c._id).lean()).toMatchObject({ emailVerified: true, marketingConsent: false });
  });
  it('does not treat unverified third-party Google email as proof of ownership', async () => {
    process.env.GOOGLE_CLIENT_ID = 'fixture-client';
    verifyGoogle.mockResolvedValue({ getPayload: () => ({ sub: 'fixture-google-sub', email: 'buyer@example.test', email_verified: true }) });
    expect((await request('/api/customers/google', { cookie: '', method: 'POST', body: { credential: 'fixture-credential' } })).status).toBe(401);
    expect(await Customer.countDocuments()).toBe(0);
  });
  it('rejects old account sessions after erasure and never recreates a contact from retained orders', async () => {
    const c = await Customer.create({ email: 'buyer@example.test', marketingConsent: true, emailVerified: true, emailVerificationToken: 'old-login-link' });
    await WishlistInterest.create({ customerId: c._id, productId: new mongoose.Types.ObjectId(), savedAt: new Date() });
    const order = await makeOrder(); await syncOrderCustomer(order._id);
    const erasedResult = await eraseCustomer(c._id); await syncOrderCustomer(order._id); await recomputeAll();
    expect(await Customer.countDocuments({ gdprDeletedAt: null })).toBe(0);
    expect((await request('/api/customers/me', { cookie: customerCookie(c._id) })).status).toBe(401);
    const erased = await Customer.findById(c._id).lean(); expect(erased).toMatchObject({ marketingConsent: false, emailVerified: false, emailVerificationToken: null, segments: [] });
    expect((await Order.findById(order._id)).customerEmail).toBe('buyer@example.test');
    expect(erasedResult.purged.wishlistInterests).toBe(1);
    expect(await WishlistInterest.countDocuments({ customerId: c._id })).toBe(0);
  });
  it('never leaks product cost fields through wishlists and de-duplicates repeated IDs', async () => {
    const c = await Customer.create({ email: 'buyer@example.test', emailVerified: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Silk fixture', slug: 'silk-fixture', status: 'active', price: 80, costPrice: 12, costing: { totalUnitCost: 12 }, images: [{ url: 'https://example.test/silk.jpg' }] });
    const cookie = customerCookie(c._id);
    const added = await request('/api/customers/me/wishlist/sync', { cookie, method: 'POST', body: { ids: [String(productId), String(productId)] } });
    expect(added.status).toBe(200);
    const response = await request('/api/customers/me/wishlist', { cookie }); const items = await response.json();
    expect(items).toHaveLength(1); expect(items[0].costPrice).toBeUndefined(); expect(items[0].costing).toBeUndefined();
    expect((await request('/api/customers/me/wishlist/not-an-id', { cookie, method: 'POST' })).status).toBe(400);
  });
  it('accepts account wishlist writes only when the storefront CSRF header is present', async () => {
    const customer = await Customer.create({ email: 'csrf-wishlist@example.test', emailVerified: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'CSRF silk', slug: 'csrf-silk', status: 'active', price: 80 });
    const path = `/api/customers/me/wishlist/${productId}`;
    const withoutHeader = await fetch(base + path, { method: 'POST', headers: { Cookie: customerCookie(customer._id) } });
    expect(withoutHeader.status).toBe(403);
    expect((await request(path, { cookie: customerCookie(customer._id), method: 'POST' })).status).toBe(200);
  });
  it('tracks account wishlist saves and only makes an old, opted-in unpurchased save eligible', async () => {
    const customer = await Customer.create({ email: 'wishlist@example.test', emailVerified: true, marketingConsent: true });
    const directProductId = new mongoose.Types.ObjectId(), syncedProductId = new mongoose.Types.ObjectId();
    await Product.collection.insertMany([
      { _id: directProductId, name: 'Direct save', slug: 'direct-save', status: 'active', price: 80 },
      { _id: syncedProductId, name: 'Synced save', slug: 'synced-save', status: 'active', price: 90 },
    ]);
    const cookie = customerCookie(customer._id);
    expect((await request(`/api/customers/me/wishlist/${directProductId}`, { cookie, method: 'POST' })).status).toBe(200);
    expect((await request('/api/customers/me/wishlist/sync', { cookie, method: 'POST', body: { ids: [String(syncedProductId)] } })).status).toBe(200);
    const directInterest = await WishlistInterest.findOne({ customerId: customer._id, productId: directProductId }).lean();
    const syncedInterest = await WishlistInterest.findOne({ customerId: customer._id, productId: syncedProductId }).lean();
    expect(directInterest?.savedAt).toBeTruthy(); expect(syncedInterest?.savedAt).toBeTruthy();

    expect((await request(`/api/customers/me/wishlist/${directProductId}`, { cookie, method: 'DELETE' })).status).toBe(200);
    expect((await WishlistInterest.findById(directInterest._id).lean()).removedAt).toBeTruthy();
    await WishlistInterest.updateOne({ _id: directInterest._id }, { $set: { completedAt: new Date(), reminderAttemptedAt: new Date(), reminderSentAt: new Date() } });
    expect((await request(`/api/customers/me/wishlist/${directProductId}`, { cookie, method: 'POST' })).status).toBe(200);
    expect(await WishlistInterest.findById(directInterest._id).lean()).toMatchObject({ removedAt: null, completedAt: null, reminderAttemptedAt: null, reminderSentAt: null });

    const now = new Date();
    await WishlistInterest.updateOne({ _id: syncedInterest._id }, { $set: { savedAt: new Date(now.getTime() - 6 * 86400000) } });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
    await WishlistInterest.updateOne({ _id: syncedInterest._id }, { $set: { savedAt: new Date(now.getTime() - 8 * 86400000) } });
    await Customer.updateOne({ _id: customer._id }, { $set: { marketingConsent: false } });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
    await Customer.updateOne({ _id: customer._id }, { $set: { marketingConsent: true, emailVerified: false } });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
    await Customer.updateOne({ _id: customer._id }, { $set: { emailVerified: true } });
    expect((await getEligibleWishlistReminders({ now })).map(candidate => String(candidate.interest._id))).toContain(String(syncedInterest._id));

    await Order.create({ customerId: customer._id, customerEmail: customer.email, status: 'paid', total: 90,
      items: [{ productId: syncedProductId, name: 'Synced save', price: 90, quantity: 1 }], createdAt: new Date(now.getTime() - 86400000) });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
    expect((await WishlistInterest.findById(syncedInterest._id).lean()).completedAt).toBeTruthy();
  });
  it('keeps the account-wide reminder cooldown after a product is removed and saved again', async () => {
    const now = new Date();
    const customer = await Customer.create({ email: 'cooldown-wishlist@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Cooldown silk', slug: 'cooldown-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId }, $set: { lastWishlistReminderAttemptedAt: new Date(now.getTime() - 86400000) } });
    await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 40 * 86400000), reminderAttemptedAt: new Date(now.getTime() - 31 * 86400000) });

    await markWishlistRemoved(customer._id, productId, new Date(now.getTime() - 9 * 86400000));
    await recordWishlistSaves(customer._id, [productId], new Date(now.getTime() - 8 * 86400000));

    expect(await WishlistInterest.findOne({ customerId: customer._id, productId }).lean()).toMatchObject({ removedAt: null, reminderAttemptedAt: null });
    expect(await getEligibleWishlistReminders({ now })).toHaveLength(0);
  });
  it('does not complete or revalidate a stale claim after a product is removed and saved again', async () => {
    const now = new Date();
    const customer = await Customer.create({ email: 'stale-claim@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Stale-claim silk', slug: 'stale-claim-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    const interest = await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 8 * 86400000) });
    const claimed = await WishlistInterest.findOneAndUpdate(
      { _id: interest._id }, { $set: { reminderAttemptedAt: now } }, { returnDocument: 'after' },
    );

    await markWishlistRemoved(customer._id, productId, new Date(now.getTime() + 1));
    await recordWishlistSaves(customer._id, [productId], new Date(now.getTime() + 2));

    await expect(revalidateClaimedWishlistReminder({ interest: claimed, now, offerCode: 'SILK10' })).resolves.toBeNull();
    expect(await WishlistInterest.findById(interest._id).lean()).toMatchObject({
      savedAt: new Date(now.getTime() + 2), completedAt: null, reminderAttemptedAt: null,
    });
  });
  it('continues past old ineligible saves to find a newer eligible reminder', async () => {
    const now = new Date();
    const blocked = await Customer.create({ email: 'blocked-wishlist@example.test', emailVerified: false, marketingConsent: false });
    await WishlistInterest.insertMany(Array.from({ length: 105 }, () => ({
      customerId: blocked._id,
      productId: new mongoose.Types.ObjectId(),
      savedAt: new Date(now.getTime() - 30 * 86400000),
    })));
    const customer = await Customer.create({ email: 'eligible-wishlist@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Eligible after queue', slug: 'eligible-after-queue', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 8 * 86400000) });

    const candidates = await getEligibleWishlistReminders({ now, limit: 1 });
    expect(candidates).toHaveLength(1);
    expect(String(candidates[0].customer._id)).toBe(String(customer._id));
  });
  it('uses only a current unlimited public percentage offer and reveals its minimum order value', async () => {
    const promo = await PromoCode.create({ code: 'silk10', type: 'percentage', value: 10, minOrderValue: 25, maxUses: 1, usageCount: 0, active: true });
    await saveSiteSettings({ welcomeOfferCode: 'silk10' });
    try {
      await expect(getActiveWishlistOffer()).resolves.toBeNull();
      await PromoCode.updateOne({ _id: promo._id }, { $set: { maxUses: null } });
      await expect(getActiveWishlistOffer()).resolves.toMatchObject({ code: 'SILK10', percent: 10, minimumOrderValue: 25 });

      await PromoCode.updateOne({ _id: promo._id }, { $set: { maxUses: 2 } });
      await expect(getActiveWishlistOffer()).resolves.toBeNull();
      await PromoCode.updateOne({ _id: promo._id }, { $set: { maxUses: null, targetCustomerId: new mongoose.Types.ObjectId() } });
      await expect(getActiveWishlistOffer()).resolves.toBeNull();
      await PromoCode.updateOne({ _id: promo._id }, { $set: { targetCustomerId: null, value: 150 } });
      await expect(getActiveWishlistOffer()).resolves.toBeNull();
    } finally {
      await saveSiteSettings({ welcomeOfferCode: 'SILK10' });
    }
  });
  it('does not claim any of several eligible saves for a capped code', async () => {
    const now = new Date();
    const promo = await PromoCode.create({ code: 'capped-reminder', type: 'percentage', value: 10, maxUses: 1, active: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Capped silk', slug: 'capped-silk', status: 'active', price: 80 });
    const customers = await Customer.create([
      { email: 'capped-one@example.test', emailVerified: true, marketingConsent: true, wishlist: [productId] },
      { email: 'capped-two@example.test', emailVerified: true, marketingConsent: true, wishlist: [productId] },
    ]);
    await WishlistInterest.insertMany(customers.map(customer => ({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 8 * 86400000) })));
    await saveSiteSettings({ welcomeOfferCode: promo.code });
    const originalApiKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 'fixture-key';
    try {
      await expect(processWishlistReminders({ now })).resolves.toMatchObject({ sent: 0, eligible: 0 });
      expect(await WishlistInterest.countDocuments({ reminderAttemptedAt: null })).toBe(2);
    } finally {
      if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = originalApiKey;
      await saveSiteSettings({ welcomeOfferCode: 'SILK10' });
    }
  });
  it('rechecks consent after a reminder is claimed and before any email is sent', async () => {
    const now = new Date();
    const customer = await Customer.create({ email: 'race-wishlist@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Race-safe silk', slug: 'race-safe-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    const interest = await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(now.getTime() - 8 * 86400000) });
    const claimed = await WishlistInterest.findOneAndUpdate({ _id: interest._id }, { $set: { reminderAttemptedAt: now } }, { returnDocument: 'after' });
    await Customer.updateOne({ _id: customer._id }, { $set: { marketingConsent: false } });

    await expect(revalidateClaimedWishlistReminder({ interest: claimed, now, offerCode: 'SILK10' })).resolves.toBeNull();
    expect(await WishlistInterest.findById(interest._id).lean()).toMatchObject({ completedAt: expect.any(Date), reminderAttemptedAt: null });
  });
  it('keeps the owner dashboard read-only when an interest has become ineligible', async () => {
    const customer = await Customer.create({ email: 'dashboard-readonly@example.test', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Dashboard silk', slug: 'dashboard-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    const interest = await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date(Date.now() - 8 * 86400000) });
    await Order.create({ customerId: customer._id, customerEmail: customer.email, status: 'paid', total: 80,
      items: [{ productId, name: 'Dashboard silk', price: 80, quantity: 1 }], createdAt: new Date() });

    expect((await request('/api/admin/wishlist')).status).toBe(200);
    expect((await WishlistInterest.findById(interest._id).lean()).completedAt).toBeNull();
  });
  it('shows current account-held wishlist items to the owner without exposing guest saves as people', async () => {
    const customer = await Customer.create({ email: 'owner-view@example.test', firstName: 'Owner', emailVerified: true, marketingConsent: true });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: productId, name: 'Owner-view silk', slug: 'owner-view-silk', status: 'active', price: 80 });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { wishlist: productId } });
    await WishlistInterest.create({ customerId: customer._id, productId, savedAt: new Date() });

    const response = await request('/api/admin/wishlist');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.summary).toMatchObject({ accountHolders: 1, savedItems: 1, trackedSaves: 1, readyInSample: 0, readinessSampleLimit: 100 });
    expect(data.automation.enabled).toBe(false);
    expect(data.people).toHaveLength(1);
    expect(data.people[0]).toMatchObject({ customerId: String(customer._id), email: customer.email, emailVerified: true, marketingConsent: true });
    expect(data.people[0].products[0]).toMatchObject({ productId: String(productId), name: 'Owner-view silk', savedAt: expect.any(String) });
  });
  it('resolves related products by canonical slug instead of casting it as an ObjectId', async () => {
    await Product.collection.insertMany([
      { name: 'Anchor', slug: 'silk-fixture', status: 'active', category: 'robes', price: 80, images: [{ url: 'https://example.test/one.jpg' }] },
      { name: 'Related', slug: 'related-fixture', status: 'active', category: 'robes', price: 90, images: [{ url: 'https://example.test/two.jpg' }] },
    ]);
    const response = await request('/api/products/related/silk-fixture', { cookie: '' });
    expect(response.status).toBe(200); expect((await response.json())[0].slug).toBe('related-fixture');
    expect((await request('/api/products/related/nonexistent-slug', { cookie: '' })).status).toBe(404);
  });
  it('refuses unsafe currency conversion and over-refunds before contacting Stripe', async () => {
    const foreign = await makeOrder({ displayCurrency: 'GBP', chargedTotal: 85 });
    expect((await request(`/api/orders/${foreign._id}/refund`, { method: 'POST', body: { amount: 10 } })).status).toBe(409);
    const eur = await makeOrder({ refundedAmount: 90 });
    expect((await request(`/api/orders/${eur._id}/refund`, { method: 'POST', body: { amount: 11 } })).status).toBe(400);
  });
  it('same-status retries do not resend email or append history; shipped orders remain sales', async () => {
    const order = await makeOrder({ status: 'shipped' });
    const update = await request(`/api/orders/${order._id}/status`, { method: 'PUT', body: { status: 'shipped' } });
    expect(update.status).toBe(200); expect(shipped).not.toHaveBeenCalled();
    expect((await Order.findById(order._id)).statusHistory).toHaveLength(0);
    await makeOrder({ status: 'cancelled', total: 900 });
    const stats = await (await request('/api/orders/stats')).json();
    expect(stats.totalOrders).toBe(1); expect(stats.revenueThisMonth).toBe(100);
  });
});
