'use strict';

const WishlistInterest = require('../models/WishlistInterest');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const PromoCode = require('../models/PromoCode');
const { PURCHASE_STATUSES } = require('../utils/customerOrderStats');
const { ordersForCustomer, escapeRegex } = require('../utils/customerIdentity');
const { getSiteSettings } = require('./siteSettings');
const { sendWishlistReminder } = require('./email');

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DELAY_DAYS = 7;
const CUSTOMER_COOLDOWN_DAYS = 30;
const MAX_REMINDERS_PER_RUN = 25;

function uniqueIds(ids) {
  return [...new Set((ids || []).map(String).filter(id => /^[0-9a-fA-F]{24}$/.test(id)))];
}

async function recordWishlistSaves(customerId, productIds, now = new Date()) {
  const ids = uniqueIds(productIds);
  await Promise.all(ids.map(productId => WishlistInterest.findOneAndUpdate(
    { customerId, productId },
    // Removing then deliberately saving again starts a fresh, dated interest.
    // A repeat save while the item is still present never reaches this helper.
    { $set: { savedAt: now, removedAt: null, completedAt: null, reminderAttemptedAt: null, reminderSentAt: null }, $setOnInsert: { customerId, productId } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )));
}

async function markWishlistRemoved(customerId, productId, now = new Date()) {
  if (!/^[0-9a-fA-F]{24}$/.test(String(productId || ''))) return;
  await WishlistInterest.updateOne({ customerId, productId }, { $set: { removedAt: now } });
}

function hasCurrentWishlistItem(customer, productId) {
  return (customer.wishlist || []).some(id => String(id) === String(productId));
}

async function hasBoughtAfterSaving(customer, productId, savedAt) {
  return Boolean(await Order.exists({
    $and: [
      ordersForCustomer(customer),
      {
        status: { $in: PURCHASE_STATUSES },
        createdAt: { $gte: savedAt },
        $or: [
          { 'items.productId': productId },
          { 'items.includedProducts.productId': productId },
        ],
      },
    ],
  }));
}

async function getActiveWishlistOffer(now = new Date()) {
  const code = String(getSiteSettings().welcomeOfferCode || '').trim().toUpperCase();
  if (!code) return null;
  const promo = await PromoCode.findOne({ code }).lean();
  if (!promo || promo.active === false || (promo.status && promo.status !== 'active') || promo.type !== 'percentage'
    || promo.targetCustomerId || promo.source === 'customer_personal') return null;
  if (promo.validFrom && new Date(promo.validFrom) > now) return null;
  if (promo.validUntil && new Date(promo.validUntil) < now) return null;
  const percent = Number(promo.value);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) return null;
  // A capped shared promotion cannot be safely promised to a batch without
  // reserving a use at checkout. Only an unlimited public code is eligible.
  const maxUses = promo.maxUses === null || promo.maxUses === undefined ? null : Number(promo.maxUses);
  if (maxUses !== null) return null;
  return {
    code: promo.code,
    percent,
    minimumOrderValue: Math.max(0, Number(promo.minOrderValue) || 0),
    validUntil: promo.validUntil || null,
  };
}

async function hasRedeemedOffer(customer, code) {
  const exactCode = new RegExp(`^${escapeRegex(code)}$`, 'i');
  return Boolean(await Order.exists({
    $and: [ordersForCustomer(customer), { status: { $in: PURCHASE_STATUSES }, discountCode: exactCode }],
  }));
}

async function getEligibleWishlistReminders({
  now = new Date(), limit = MAX_REMINDERS_PER_RUN, offerCode = null, completeIneligible = true,
} = {}) {
  const cutoff = new Date(now.getTime() - REMINDER_DELAY_DAYS * DAY);
  const eligible = [];
  const includedCustomerIds = new Set();
  const cooldown = new Date(now.getTime() - CUSTOMER_COOLDOWN_DAYS * DAY);
  const batchSize = Math.max(100, Math.min(limit * 10, 500));
  let after = null;

  // Keep moving through the pending queue. A large block of old saves that are
  // no longer eligible must not permanently hide a newer eligible customer.
  while (eligible.length < limit) {
    const query = {
      savedAt: { $lte: cutoff },
      removedAt: null,
      completedAt: null,
      reminderAttemptedAt: null,
    };
    if (after) {
      query.$or = [
        { savedAt: { $gt: after.savedAt } },
        { savedAt: after.savedAt, _id: { $gt: after._id } },
      ];
    }
    const interests = await WishlistInterest.find(query)
      .sort({ savedAt: 1, _id: 1 }).limit(batchSize).lean();
    if (!interests.length) break;

    const [customers, products] = await Promise.all([
      Customer.find({
        _id: { $in: interests.map(i => i.customerId) },
        gdprDeletedAt: null,
        emailVerified: true,
        marketingConsent: true,
        email: { $exists: true, $nin: [null, ''] },
      }).select('_id email firstName wishlist lastWishlistReminderAttemptedAt').lean(),
      Product.find({ _id: { $in: interests.map(i => i.productId) }, status: 'active' })
        .select('_id name slug price').lean(),
    ]);
    const customerById = new Map(customers.map(customer => [String(customer._id), customer]));
    const productById = new Map(products.map(product => [String(product._id), product]));

    for (const interest of interests) {
      const customer = customerById.get(String(interest.customerId));
      const product = productById.get(String(interest.productId));
      if (!customer || !product || !hasCurrentWishlistItem(customer, interest.productId)) continue;
      if (includedCustomerIds.has(String(customer._id))) continue;
      if (await hasBoughtAfterSaving(customer, interest.productId, interest.savedAt)) {
        if (completeIneligible) {
          await WishlistInterest.updateOne(
            { _id: interest._id, savedAt: interest.savedAt, removedAt: null, completedAt: null, reminderAttemptedAt: null },
            { $set: { completedAt: now } },
            { timestamps: false },
          );
        }
        continue;
      }
      if (offerCode && await hasRedeemedOffer(customer, offerCode)) {
        if (completeIneligible) {
          await WishlistInterest.updateOne(
            { _id: interest._id, savedAt: interest.savedAt, removedAt: null, completedAt: null, reminderAttemptedAt: null },
            { $set: { completedAt: now } },
            { timestamps: false },
          );
        }
        continue;
      }
      if (customer.lastWishlistReminderAttemptedAt && new Date(customer.lastWishlistReminderAttemptedAt) >= cooldown) continue;
      eligible.push({ interest, customer, product });
      includedCustomerIds.add(String(customer._id));
      if (eligible.length >= limit) break;
    }
    after = interests[interests.length - 1];
    if (interests.length < batchSize) break;
  }
  return eligible;
}

function claimedInterestFilter(interest) {
  return {
    _id: interest._id,
    savedAt: interest.savedAt,
    removedAt: null,
    completedAt: null,
    reminderAttemptedAt: interest.reminderAttemptedAt,
  };
}

async function completeWishlistInterest(interest, now) {
  await WishlistInterest.updateOne(
    claimedInterestFilter(interest),
    { $set: { completedAt: now, reminderAttemptedAt: null } },
    { timestamps: false },
  );
}

// The candidate list is read in a batch. Re-check before sending so a change
// in consent, saved-item state, product state, purchase history or GDPR status
// always wins over the scheduled email.
async function revalidateClaimedWishlistReminder({ interest, now = new Date(), offerCode = null }) {
  const [stillClaimed, customer, product] = await Promise.all([
    WishlistInterest.exists(claimedInterestFilter(interest)),
    Customer.findOne({
      _id: interest.customerId,
      gdprDeletedAt: null,
      emailVerified: true,
      marketingConsent: true,
      email: { $exists: true, $nin: [null, ''] },
    }).select('_id email firstName wishlist lastWishlistReminderAttemptedAt').lean(),
    Product.findOne({ _id: interest.productId, status: 'active' }).select('_id name slug price').lean(),
  ]);
  // The shopper may have removed and saved this product again after the
  // scheduler claimed the old lifecycle row. That new save must win.
  if (!stillClaimed) return null;
  if (!customer || !product || !hasCurrentWishlistItem(customer, interest.productId)) {
    await completeWishlistInterest(interest, now);
    return null;
  }
  if (await hasBoughtAfterSaving(customer, interest.productId, interest.savedAt)
    || (offerCode && await hasRedeemedOffer(customer, offerCode))) {
    await completeWishlistInterest(interest, now);
    return null;
  }
  return { customer, product };
}

async function claimCustomerReminderCooldown(customerId, productId, now) {
  const cooldown = new Date(now.getTime() - CUSTOMER_COOLDOWN_DAYS * DAY);
  return Customer.findOneAndUpdate(
    {
      _id: customerId,
      gdprDeletedAt: null,
      emailVerified: true,
      marketingConsent: true,
      email: { $exists: true, $nin: [null, ''] },
      wishlist: productId,
      $or: [
        { lastWishlistReminderAttemptedAt: null },
        { lastWishlistReminderAttemptedAt: { $lt: cooldown } },
      ],
    },
    { $set: { lastWishlistReminderAttemptedAt: now } },
    { returnDocument: 'after', timestamps: false },
  );
}

async function processWishlistReminders({ now = new Date(), limit = MAX_REMINDERS_PER_RUN } = {}) {
  if (!process.env.RESEND_API_KEY) return { sent: 0, eligible: 0, reason: 'Email not configured' };
  const offer = await getActiveWishlistOffer(now);
  if (!offer) return { sent: 0, eligible: 0, reason: 'Configured wishlist offer is not an active unlimited percentage offer' };

  const candidates = await getEligibleWishlistReminders({ now, limit, offerCode: offer.code });
  let sent = 0;
  for (const candidate of candidates) {
    // Claim before sending. Like restock notices, one failed attempt is safer
    // than a person receiving a reminder every hour after a mail-provider hiccup.
    const claimed = await WishlistInterest.findOneAndUpdate(
      { _id: candidate.interest._id, savedAt: candidate.interest.savedAt, removedAt: null, completedAt: null, reminderAttemptedAt: null },
      { $set: { reminderAttemptedAt: now } },
      { returnDocument: 'after', timestamps: false },
    );
    if (!claimed) continue;
    try {
      // Do not promise a discount that was paused, edited or exhausted after
      // the run began. No email has been sent, so a future active offer may
      // still make this save eligible.
      const currentOffer = await getActiveWishlistOffer(new Date());
      if (!currentOffer) {
        await WishlistInterest.updateOne(
          claimedInterestFilter(claimed),
          { $set: { reminderAttemptedAt: null } },
          { timestamps: false },
        );
        break;
      }
      const current = await revalidateClaimedWishlistReminder({
        interest: claimed,
        now,
        offerCode: currentOffer.code,
      });
      if (!current) continue;
      const customerCooldown = await claimCustomerReminderCooldown(current.customer._id, current.product._id, now);
      if (!customerCooldown) {
        await WishlistInterest.updateOne(
          claimedInterestFilter(claimed),
          { $set: { reminderAttemptedAt: null } },
          { timestamps: false },
        );
        continue;
      }
      if (!(await WishlistInterest.exists(claimedInterestFilter(claimed)))) continue;
      await sendWishlistReminder({
        email: current.customer.email,
        firstName: current.customer.firstName,
        customerId: current.customer._id,
        product: current.product,
        offer: currentOffer,
      });
      await Promise.all([
        WishlistInterest.updateOne(claimedInterestFilter(claimed), { $set: { reminderSentAt: now } }, { timestamps: false }),
        Customer.updateOne({ _id: candidate.customer._id }, {
          $push: { emailLog: { $each: [{ subject: `A piece you saved — ${currentOffer.percent}% off`, template: 'wishlist-reminder', sentAt: now }], $slice: -100 } },
        }, { timestamps: false }),
      ]);
      sent++;
    } catch (err) {
      console.error('[wishlist-reminder] send failed:', String(candidate.interest._id), err.message);
    }
  }
  if (sent) console.log(`[wishlist-reminder] sent ${sent} reminder(s)`);
  return { sent, eligible: candidates.length };
}

module.exports = {
  REMINDER_DELAY_DAYS,
  CUSTOMER_COOLDOWN_DAYS,
  MAX_REMINDERS_PER_RUN,
  recordWishlistSaves,
  markWishlistRemoved,
  getActiveWishlistOffer,
  getEligibleWishlistReminders,
  revalidateClaimedWishlistReminder,
  processWishlistReminders,
};
