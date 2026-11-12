'use strict';
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { normalizeEmail, ordersForCustomer, erasedEmailHash } = require('../utils/customerIdentity');
const { isPurchase, customerOrderStats } = require('../utils/customerOrderStats');
const { computeSegmentsForCustomer, recomputeAll } = require('./segments');
const VERSION = 1;
const pendingFilter = { $or: [{ customerSyncVersion: { $ne: VERSION } }, { customerSyncPending: true }] };

// One transaction per order. Touching the shared Customer serializes simultaneous purchases;
// Mongo retries write conflicts, then statistics are re-derived rather than incremented twice.
async function syncTransaction(orderId) {
  let outcome;
  await mongoose.connection.transaction(async session => {
    const order = await Order.findById(orderId).session(session).lean();
    if (!order) { outcome = { status: 'not_found' }; return; }
    const finish = async status => {
      await Order.updateOne({ _id: order._id }, { $set: {
        customerSyncVersion: VERSION, customerSyncPending: false, customerSyncStatus: status,
      } }, { session, timestamps: false });
      outcome = { status };
    };
    const email = normalizeEmail(order.customerEmail);
    let customer = order.customerId ? await Customer.findById(order.customerId).session(session) : null;
    if (order.customerId && !customer) { await finish('invalid_customer_link'); return; }
    if (customer?.gdprDeletedAt) { await finish('erased'); return; }
    if (!customer && !email) { await finish(isPurchase(order) ? 'missing_email' : 'not_a_purchase'); return; }
    if (customer && email && normalizeEmail(customer.email) !== email) { await finish('invalid_customer_link'); return; }
    const erased = email ? await Customer.findOne({ erasedEmailHash: erasedEmailHash(email), gdprDeletedAt: { $ne: null } }).session(session).lean() : null;
    if (erased && new Date(order.createdAt) <= new Date(erased.gdprDeletedAt)) { await finish('erased'); return; }
    if (!customer) customer = await Customer.findOne({ email, gdprDeletedAt: null }).session(session);
    if (!customer && !isPurchase(order)) { await finish('not_a_purchase'); return; }
    let created = false;
    if (!customer) {
      const parts = (typeof order.customerName === 'string' ? order.customerName.trim() : '').split(/\s+/);
      // A CRM contact is NOT a login or permission to send marketing. No mail is sent here.
      customer = new Customer({ email, firstName: parts.shift() || '', lastName: parts.join(' '),
        profileSource: 'order', marketingConsent: false, emailVerified: false });
      await customer.save({ session });
      created = true;
    }
    await Customer.updateOne({ _id: customer._id, gdprDeletedAt: null }, { $inc: { orderSyncRevision: 1 } }, { session });
    const match = ordersForCustomer(customer);
    if (erased) match.createdAt = { $gt: erased.gdprDeletedAt };
    // Link historical email-only records too, but never overwrite another explicit identity.
    const linked = await Order.updateMany({ ...match, customerId: null }, { $set: { customerId: customer._id } }, { session, timestamps: false });
    const orders = await Order.find({ ...match }).select('status total refundedAmount costs.refundedAmount createdAt shippingAddress.country shippingAddress.city attribution utm').session(session).lean();
    const stats = customerOrderStats(orders);
    const purchases = orders.filter(isPurchase).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    const first = purchases[0], last = purchases.at(-1);
    const segments = await computeSegmentsForCustomer({ ...customer.toObject(), ...stats });
    // Retain a previous VIP tag until the full percentile refresh; do not manufacture one here.
    if (customer.segments?.includes('vip') && stats.totalSpend > 0) segments.unshift('vip');
    const update = { ...stats, segments, country: last?.shippingAddress?.country || customer.country || '', city: last?.shippingAddress?.city || customer.city || '' };
    if (!customer.acquisitionSource && first) Object.assign(update, {
      acquisitionSource: first.utm?.source || first.attribution?.source || '',
      acquisitionMedium: first.utm?.medium || first.attribution?.medium || '',
      acquisitionCampaign: first.utm?.campaign || first.attribution?.campaign || '', acquiredAt: first.createdAt,
    });
    await Customer.updateOne({ _id: customer._id, gdprDeletedAt: null }, { $set: update }, { session });
    await finish('synced');
    outcome = { status: 'synced', created, linkedOrders: linked.modifiedCount };
  }, { maxCommitTimeMS: 10000 });
  return outcome;
}

// Concurrent first purchases can race on the unique email index. The failed
// transaction has no committed side effects; retry against the winning profile.
async function syncOrderCustomer(orderId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await syncTransaction(orderId); }
    catch (err) { if (err.code !== 11000 || attempt === 2) throw err; }
  }
}

// A durable database flag, not an untracked fire-and-forget promise. If synchronization
// fails after a sale, the committed order survives and the bounded worker retries it.
async function syncAfterOrderChange(order) {
  try {
    await Order.updateOne({ _id: order._id }, { $set: { customerSyncPending: true } }, { timestamps: false });
    return await syncOrderCustomer(order._id);
  } catch (err) {
    console.error('[customer-sync] deferred; order retained', err.code || err.name);
    return { status: 'deferred' };
  }
}
let running = false;
async function reconcileCustomerOrders({ limit = 50, dryRun = false } = {}) {
  if (running) return { busy: true };
  running = true;
  try {
    const bounded = Math.min(100, Math.max(1, Number(limit) || 50));
    const orders = await Order.find(pendingFilter).select('_id').sort({ _id: 1 }).limit(bounded).lean();
    const report = { scanned: orders.length, created: 0, linkedOrders: 0, synced: 0, skipped: 0, failed: 0, dryRun };
    if (!dryRun) {
      for (const order of orders) {
        try {
          const result = await syncOrderCustomer(order._id);
          if (result.created) report.created++;
          report.linkedOrders += result.linkedOrders || 0;
          result.status === 'synced' ? report.synced++ : report.skipped++;
        } catch (err) {
          report.failed++;
          console.error('[customer-sync] retryable reconciliation failure', err.code || err.name);
        }
      }
      await recomputeAll();
    }
    report.remaining = await Order.countDocuments(pendingFilter);
    report.unresolved = await Order.countDocuments({ customerSyncStatus: { $in: ['missing_email', 'invalid_customer_link'] } });
    return report;
  } finally { running = false; }
}
module.exports = { syncOrderCustomer, syncAfterOrderChange, reconcileCustomerOrders, pendingFilter };
