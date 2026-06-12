'use strict';

// Watchdog — the Growth Engine's health monitor. No AI calls; pure data
// checks against the live database (plus a read-only Merchant Center poll).
// Runs daily and raises at most one aggregated action per problem area so
// the pulse feed stays readable. All-clear runs post a single summary.

const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Review = require('../../models/Review');
const merchantCenter = require('../merchantCenter');

const DAY_MS = 24 * 3600 * 1000;

// 1. Bestseller risk — products that sold in the last 30 days but are now
//    out of stock. Losing a proven seller is the most expensive silent failure.
async function checkBestsellerStock() {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const sold = await Order.aggregate([
    { $match: { status: { $in: ['paid', 'shipped', 'delivered'] }, createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $ne: null } } },
    { $group: { _id: '$items.productId' } },
  ]);
  const soldIds = sold.map(s => s._id);
  if (!soldIds.length) return null;

  const outOfStock = await Product.find({
    _id: { $in: soldIds },
    $or: [{ totalStock: { $lte: 0 } }, { status: 'sold_out' }],
  }).select('name').lean();
  if (!outOfStock.length) return null;

  const names = outOfStock.slice(0, 5).map(p => p.name);
  const more = outOfStock.length - names.length;
  return {
    type: 'alert',
    title: `${outOfStock.length} selling product${outOfStock.length === 1 ? ' is' : 's are'} out of stock`,
    detail: `Sold in the last 30 days but no stock left: ${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}. Restock to avoid losing proven sellers.`,
    href: '/admin/inventory',
    status: 'info',
  };
}

// 2. Listing gaps — active products missing a meta title or any image.
//    Matches the ?issues=no-seo / no-images filters in routes/adminProducts.js.
async function checkListingGaps() {
  const count = await Product.countDocuments({
    status: 'active',
    $or: [
      { metaTitle: { $in: [null, ''] } },
      { 'images.0': { $exists: false } },
    ],
  });
  if (!count) return null;
  return {
    type: 'alert',
    title: `${count} active product${count === 1 ? '' : 's'} missing meta title or images`,
    detail: 'These listings underperform in search and Google Shopping until the gaps are filled.',
    href: '/admin/products?issues=no-seo',
    status: 'info',
  };
}

// 3. Merchant Center disapprovals — read-only poll. API failure must never
//    kill the run; we just skip the check this time.
async function checkMerchantCenter() {
  try {
    if (!merchantCenter.isConfigured()) return null;
    const result = await merchantCenter.getProductIssues();
    if (!result.configured || !(result.disapproved > 0)) return null;
    const top = (result.issues && result.issues[0]) || null;
    return {
      type: 'alert',
      title: `${result.disapproved} product${result.disapproved === 1 ? '' : 's'} disapproved in Google Merchant Center`,
      detail: top
        ? `Top issue: ${top.description || top.code}${top.count ? ` (${top.count} affected)` : ''}. See the Merchant Center panel on the dashboard.`
        : 'See the Merchant Center panel on the dashboard for details.',
      href: '/admin',
      status: 'info',
    };
  } catch (err) {
    console.error('[watchdog] Merchant Center check skipped:', err.message);
    return null;
  }
}

// 4. Stale fulfilment — paid/processing orders older than 3 days.
async function checkStaleFulfilment() {
  const cutoff = new Date(Date.now() - 3 * DAY_MS);
  const count = await Order.countDocuments({
    status: { $in: ['paid', 'processing'] },
    createdAt: { $lt: cutoff },
  });
  if (!count) return null;
  return {
    type: 'alert',
    title: `${count} order${count === 1 ? '' : 's'} waiting to ship for over 3 days`,
    detail: 'Paid or processing orders older than 3 days. Late shipping is the fastest route to bad reviews.',
    href: '/admin/orders?status=paid',
    status: 'info',
  };
}

// 5. Review moderation backlog — pending reviews never reach the storefront.
async function checkReviewBacklog() {
  const count = await Review.countDocuments({ status: 'pending' });
  if (!count) return null;
  return {
    type: 'info',
    title: `${count} review${count === 1 ? '' : 's'} awaiting moderation`,
    detail: 'Pending reviews are invisible on the storefront until approved.',
    href: '/admin/reviews',
    status: 'info',
  };
}

async function run() {
  const actions = [];
  for (const check of [
    checkBestsellerStock,
    checkListingGaps,
    checkMerchantCenter,
    checkStaleFulfilment,
    checkReviewBacklog,
  ]) {
    const action = await check();
    if (action) actions.push(action);
  }

  if (!actions.length) {
    return [{
      type: 'info',
      title: 'All clear — checked stock, listings and orders',
      detail: 'Checked recently-sold products for stock-outs, active listings for missing meta titles/images, Merchant Center approval status, orders waiting to ship, and the review moderation queue. No issues found.',
      status: 'info',
    }];
  }
  return actions.slice(0, 5);
}

module.exports = {
  name: 'watchdog',
  label: 'Watchdog',
  description: 'Daily health checks on stock, listings, Merchant Center, fulfilment and reviews — pure data, no AI.',
  cadenceHours: 24,
  defaultEnabled: true,
  run,
};
