'use strict';

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const WishlistInterest = require('../models/WishlistInterest');
const { requireAuth } = require('../middleware/auth');
const {
  REMINDER_DELAY_DAYS,
  getActiveWishlistOffer,
  getEligibleWishlistReminders,
} = require('../services/wishlistReminders');

const READINESS_SAMPLE_LIMIT = 100;

router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/', async (req, res) => {
  try {
    const currentWishlist = { gdprDeletedAt: null, 'wishlist.0': { $exists: true } };
    const emailConfigured = Boolean(process.env.RESEND_API_KEY);
    const [summaryRows, topRows, people, offer] = await Promise.all([
      Customer.aggregate([
        { $match: currentWishlist },
        { $project: { itemCount: { $size: '$wishlist' } } },
        { $group: { _id: null, accountHolders: { $sum: 1 }, savedItems: { $sum: '$itemCount' } } },
      ]),
      Customer.aggregate([
        { $match: currentWishlist },
        { $unwind: '$wishlist' },
        { $group: { _id: '$wishlist', saves: { $sum: 1 } } },
        { $sort: { saves: -1, _id: 1 } },
        { $limit: 20 },
      ]),
      Customer.find(currentWishlist).select('_id email firstName lastName wishlist marketingConsent emailVerified updatedAt')
        .sort({ updatedAt: -1 }).limit(50).lean(),
      getActiveWishlistOffer(),
    ]);

    const summary = summaryRows[0] || { accountHolders: 0, savedItems: 0 };
    const productIds = [...new Set([
      ...topRows.map(row => String(row._id)),
      ...people.flatMap(person => (person.wishlist || []).map(String)),
    ].filter(id => /^[0-9a-fA-F]{24}$/.test(id)))];
    const automationEnabled = Boolean(offer && emailConfigured);
    const [products, interests, trackedSaves, candidates] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('_id name slug price status image images').lean(),
      WishlistInterest.find({ customerId: { $in: people.map(person => person._id) }, productId: { $in: productIds }, removedAt: null })
        .select('customerId productId savedAt completedAt reminderAttemptedAt reminderSentAt').lean(),
      WishlistInterest.countDocuments({ removedAt: null }),
      automationEnabled
        ? getEligibleWishlistReminders({ limit: READINESS_SAMPLE_LIMIT, offerCode: offer.code, completeIneligible: false })
        : Promise.resolve([]),
    ]);
    const productById = new Map(products.map(product => [String(product._id), product]));
    const interestByPair = new Map(interests.map(interest => [`${interest.customerId}:${interest.productId}`, interest]));
    const eligiblePairs = new Set(candidates.map(candidate => `${candidate.customer._id}:${candidate.product._id}`));

    res.json({
      summary: {
        accountHolders: summary.accountHolders,
        savedItems: summary.savedItems,
        trackedSaves,
        readyInSample: candidates.length,
        readinessSampleLimit: READINESS_SAMPLE_LIMIT,
      },
      automation: {
        delayDays: REMINDER_DELAY_DAYS,
        offer,
        emailConfigured,
        enabled: automationEnabled,
      },
      topProducts: topRows.map(row => {
        const product = productById.get(String(row._id));
        return {
          productId: String(row._id),
          name: product?.name || 'Unavailable product',
          slug: product?.slug || null,
          price: product?.price ?? null,
          status: product?.status || 'unavailable',
          saves: row.saves,
        };
      }),
      people: people.map(person => ({
        customerId: String(person._id),
        name: [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email,
        email: person.email,
        marketingConsent: person.marketingConsent,
        emailVerified: person.emailVerified,
        products: (person.wishlist || []).map(id => {
          const product = productById.get(String(id));
          const interest = interestByPair.get(`${person._id}:${id}`);
          return {
            productId: String(id),
            name: product?.name || 'Unavailable product',
            slug: product?.slug || null,
            status: product?.status || 'unavailable',
            savedAt: interest?.savedAt || null,
            completedAt: interest?.completedAt || null,
            reminderAttemptedAt: interest?.reminderAttemptedAt || null,
            reminderSentAt: interest?.reminderSentAt || null,
            eligible: eligiblePairs.has(`${person._id}:${id}`),
          };
        }),
      })),
    });
  } catch (err) {
    console.error('[admin/wishlist]', err.message);
    res.status(500).json({ error: 'Could not load wishlist intelligence.' });
  }
});

module.exports = router;
