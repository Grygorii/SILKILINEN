/**
 * Backfill: link orphan Orders to Customer docs by email, then update Customer stats.
 * Safe to re-run — uses $setOnInsert / conditional updates.
 * Run: node backend/scripts/backfillCustomerOrderLinks.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { recomputeAll, ensureSegmentDocs } = require('../services/segments');

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Link orders that have a customerEmail but no customerId
  const orphans = await Order.find({ customerEmail: { $ne: null }, customerId: null }).lean();
  console.log(`Found ${orphans.length} orphan orders to link`);

  let linked = 0;
  for (const order of orphans) {
    const customer = await Customer.findOne({ email: order.customerEmail });
    if (!customer) continue;
    await Order.updateOne({ _id: order._id }, { $set: { customerId: customer._id } });
    linked++;
  }
  console.log(`Linked ${linked} orders to customer docs`);

  // 2. Recompute stats for all customers that have orders
  const customerEmails = await Order.distinct('customerEmail', { customerEmail: { $ne: null } });
  console.log(`Recomputing stats for ${customerEmails.length} customer emails`);

  let updated = 0;
  for (const email of customerEmails) {
    const customer = await Customer.findOne({ email });
    if (!customer) continue;

    const orders = await Order.find({ customerEmail: email }).sort({ createdAt: 1 }).lean();
    const paidOrders = orders.filter(o => PAID_STATUSES.includes(o.status));

    const firstOrderAt = orders[0]?.createdAt || null;
    const lastOrder = orders[orders.length - 1];
    const lastOrderAt = lastOrder?.createdAt || null;
    const orderCount = paidOrders.length;
    const totalSpend = paidOrders.reduce((s, o) => s + (o.total || 0), 0);

    // Location from most recent order shipping address
    const lastShipping = lastOrder?.shippingAddress;
    const country = lastShipping?.country || customer.country || '';
    const city = lastShipping?.city || customer.city || '';

    // Acquisition from earliest order's UTM
    const firstPaid = paidOrders[0];
    const acquisitionSource = customer.acquisitionSource || firstPaid?.utm?.source || firstPaid?.attribution?.source || '';
    const acquisitionMedium = customer.acquisitionMedium || firstPaid?.utm?.medium || firstPaid?.attribution?.medium || '';
    const acquisitionCampaign = customer.acquisitionCampaign || firstPaid?.utm?.campaign || firstPaid?.attribution?.campaign || '';
    const acquiredAt = customer.acquiredAt || firstPaid?.createdAt || null;

    await Customer.updateOne({ _id: customer._id }, {
      $set: {
        firstOrderAt, lastOrderAt, orderCount, totalSpend,
        country, city,
        acquisitionSource, acquisitionMedium, acquisitionCampaign, acquiredAt,
      },
    });
    updated++;
  }
  console.log(`Updated stats for ${updated} customers`);

  // 3. Recompute segments
  console.log('Recomputing segments…');
  await ensureSegmentDocs();
  const result = await recomputeAll();
  console.log(`Segments recomputed for ${result.updated} customers`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
