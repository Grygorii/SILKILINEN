const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { flagReview } = require('../services/reviewModeration');
const { signReviewToken, verifyReviewToken, verifyReceiptToken, tokenMatchesEmail } = require('../utils/reviewToken');
const { SHIPMENT_STATUSES } = require('../utils/orderStates');
const { lightRateLimit } = require('../middleware/rateLimits');

// 3 review submissions per IP per hour. Reviews are usually a once-per-
// product action, so any IP submitting more is either a moderator
// testing or a spammer. Skip in non-prod so dev seeds still work.
const submitRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review submissions. Please try again later.' },
  skip: () => process.env.NODE_ENV !== 'production',
});

// ── GET /api/reviews — public list ────────────────────────────────────
// Backward-compatible: if no params, returns the legacy array shape the
// homepage carousel expects. Only ever returns status=approved reviews
// so pending/rejected/spam never leak to the storefront.
router.get('/', async function(req, res) {
  try {
    const { sort = 'recent', page, limit, productId } = req.query;
    // Every APPROVED review, at any rating.
    //
    // This used to filter to 4★ and up, which is a different thing from
    // moderation: rejecting spam is legitimate, hiding a genuine 3★ is
    // selective presentation. Three reasons it had to change, in increasing
    // order of seriousness:
    //   - Trust. A wall of nothing but 5★ reads as fake, and shoppers convert
    //     BETTER on a mix that includes criticism, because it proves the rest.
    //   - Google. Review snippet policy forbids showing an aggregate built from
    //     a filtered subset; the penalty is losing rich results entirely.
    //   - Law. For an Irish trader selling into the EU/UK, presenting reviews
    //     without disclosing that negative ones are suppressed is a listed
    //     unfair practice under the Omnibus Directive and the UK's DMCC.
    // Moderation still applies — pending, rejected and spam never appear.
    const filter = { status: 'approved', source: { $ne: 'seed' } };
    if (productId) filter.productId = productId;

    if (!page && !limit && sort === 'recent' && !productId) {
      const reviews = await Review.find(filter)
        .sort({ dateReviewed: -1 })
        .select('-__v -ip -userAgent');
      return res.json(reviews);
    }

    const sortMap = {
      recent:  { dateReviewed: -1 },
      helpful: { helpfulCount: -1, dateReviewed: -1 },
      highest: { starRating: -1, dateReviewed: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.recent;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip     = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(filter).sort(sortObj).skip(skip).limit(limitNum)
        .populate('productId', 'name slug images')
        .select('-__v -ip -userAgent'),
      Review.countDocuments(filter),
    ]);

    res.json({ reviews, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/reviews/summary — brand aggregate ────────────────────────
router.get('/summary', async function(req, res) {
  try {
    const { productId } = req.query;
    // The average must describe ALL approved reviews. Computing it from 4★+
    // only meant the number could never fall below 4.0 whatever customers
    // actually said — and this figure feeds aggregateRating in the product
    // JSON-LD, so it was being asserted to Google as fact.
    const filter = { status: 'approved', source: { $ne: 'seed' } };
    if (productId) filter.productId = productId;

    const all = await Review.find(filter).select('starRating');
    if (all.length === 0) return res.json({ average: 0, count: 0, distribution: {} });

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const r of all) {
      distribution[r.starRating] = (distribution[r.starRating] || 0) + 1;
      sum += r.starRating;
    }

    res.json({
      average: Math.round((sum / all.length) * 10) / 10,
      count: all.length,
      distribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/reviews — customer submission ───────────────────────────
// New reviews always land as status=pending. The auto-flag heuristics
// add advisory tags so the admin can triage quickly but every review
// still requires manual approval before going live.
router.post('/', submitRateLimit, async function(req, res) {
  try {
    const { reviewer, title, message, starRating, productId } = req.body;

    // Hard guards before heuristics
    if (!reviewer || typeof reviewer !== 'string') {
      return res.status(400).json({ error: 'Reviewer name is required.' });
    }
    const rating = Number(starRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }
    if (typeof message === 'string' && message.length > 2000) {
      return res.status(400).json({ error: 'Review is too long (max 2000 characters).' });
    }

    // Honeypot field — bots typically fill every input. Real users never
    // see this. If anything is submitted in it, drop the request silently
    // with a 200 so the bot moves on.
    if (req.body.website || req.body.url) {
      return res.json({ success: true });
    }

    // Verify productId points at a real active product if supplied
    let resolvedProductId = null;
    if (productId) {
      const product = await Product.findById(productId).select('_id').lean();
      if (!product) return res.status(400).json({ error: 'Product not found.' });
      resolvedProductId = product._id;
    }

    const flagReasons = flagReview({ reviewer, title, message });

    const review = await Review.create({
      reviewer: reviewer.trim(),
      title: typeof title === 'string' ? title.trim() : '',
      message: typeof message === 'string' ? message.trim() : '',
      starRating: rating,
      productId: resolvedProductId,
      source: 'site',
      status: 'pending',
      verified: false, // legacy field; cleared until admin approves
      flagReasons,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    // Don't leak the audit fields back to the submitter
    res.status(201).json({
      success: true,
      review: {
        _id: review._id,
        reviewer: review.reviewer,
        starRating: review.starRating,
        status: review.status,
        message: 'Thank you — your review will appear once approved by our team.',
      },
    });
  } catch (err) {
    console.error('[reviews] submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reading the invitation, including email link previews, never marks receipt.
router.post('/order-receipt', lightRateLimit, async function(req, res) {
  res.set('Cache-Control', 'no-store');
  const { token, action } = req.body || {};
  if (action !== 'check' && action !== 'confirm') {
    return res.status(400).json({ error: 'Invalid receipt action.' });
  }
  const decoded = verifyReceiptToken(token);
  const invalidLink = () => res.status(401).json({ error: 'This link is invalid or has expired.' });
  if (!decoded) return invalidLink();

  try {
    const match = {
      _id: decoded.orderId,
      shippedAt: decoded.shippedAt,
      status: { $in: SHIPMENT_STATUSES },
    };
    const order = await Order.findOne(match).select('customerEmail customerReceivedAt items').lean();
    if (!order || !tokenMatchesEmail(decoded, order.customerEmail)) return invalidLink();

    let receivedAt = order.customerReceivedAt;
    if (action === 'confirm' && !receivedAt) {
      const sameShipment = { ...match, customerEmail: order.customerEmail };
      const updated = await Order.findOneAndUpdate(
        { ...sameShipment, customerReceivedAt: null },
        { $set: { customerReceivedAt: new Date() } },
        { returnDocument: 'after' }
      ).select('customerReceivedAt').lean();
      const recorded = updated || await Order.findOne(sameShipment).select('customerReceivedAt').lean();
      if (!recorded?.customerReceivedAt) return invalidLink();
      receivedAt = recorded.customerReceivedAt;
    }

    const ids = [...new Set((order.items || []).flatMap(item => [
      item.productId, ...(item.includedProducts || []).map(product => product.productId),
    ]).filter(Boolean).map(String))];
    const [products, reviewedIds] = ids.length ? await Promise.all([
      Product.find({ _id: { $in: ids }, status: { $ne: 'archived' } }).select('name').lean(),
      Review.distinct('productId', { orderRefId: decoded.orderId, source: 'order' }),
    ]) : [[], []];
    const reviewed = new Set(reviewedIds.map(String));
    const items = products.filter(product => !reviewed.has(String(product._id))).map(product => ({
      id: String(product._id),
      name: product.name,
      href: `/write-review?token=${signReviewToken({
        orderId: decoded.orderId, productId: product._id, customerEmail: order.customerEmail,
      })}`,
    }));
    res.json({ confirmed: Boolean(receivedAt), items });
  } catch (err) {
    console.error('[reviews/order-receipt] failed:', err.code || err.name);
    res.status(500).json({ error: 'We couldn’t open your order right now. Please try again.' });
  }
});

// ── GET /api/reviews/from-token — verify token + return product info ──
// Used by the public /write-review page to validate a click before
// showing the form. Returns the product header info and whether this
// token has already been redeemed.
router.get('/from-token', async function(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    const decoded = verifyReviewToken(req.query.token);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired link.' });

    const [order, product, existing] = await Promise.all([
      Order.findById(decoded.orderId).select('_id customerEmail customerName').lean(),
      Product.findById(decoded.productId).select('name images slug').lean(),
      Review.findOne({
        orderRefId: String(decoded.orderId),
        productId: decoded.productId,
        source: 'order',
      }).select('_id status').lean(),
    ]);

    if (!order || !product) return res.status(404).json({ error: 'Order or product not found.' });
    if (!tokenMatchesEmail(decoded, order.customerEmail)) {
      return res.status(401).json({ error: 'Token does not match this order.' });
    }

    const primary = (product.images || []).find(img => img.isPrimary) || (product.images || [])[0];

    res.json({
      product: {
        _id: String(product._id),
        name: product.name,
        slug: product.slug,
        image: primary?.url || null,
      },
      customerName: order.customerName || '',
      alreadyReviewed: !!existing,
    });
  } catch (err) {
    console.error('[reviews/from-token] verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/reviews/from-token — verified-purchase submission ───────
// Consumes a token, creates a review with verifiedPurchase=true and
// source='order'. Still lands as status='pending' — verified-purchase
// is a trust badge, not an auto-approve. Admin still reviews the body.
router.post('/from-token', async function(req, res) {
  try {
    const decoded = verifyReviewToken(req.body.token);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired link.' });

    const order = await Order.findById(decoded.orderId).select('_id customerEmail customerName').lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!tokenMatchesEmail(decoded, order.customerEmail)) {
      return res.status(401).json({ error: 'Token does not match this order.' });
    }

    // Single-use per (order, product): the orderRefId + productId pair
    // is unique to a real order line and prevents the same token from
    // being submitted twice if the user reloads or clicks again.
    const alreadyReviewed = await Review.findOne({
      orderRefId: String(decoded.orderId),
      productId: decoded.productId,
      source: 'order',
    }).select('_id').lean();
    if (alreadyReviewed) return res.status(409).json({ error: 'A review already exists for this item.' });

    const { reviewer, title, message, starRating } = req.body;
    if (!reviewer || typeof reviewer !== 'string') {
      return res.status(400).json({ error: 'Reviewer name is required.' });
    }
    const rating = Number(starRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }
    if (typeof message === 'string' && message.length > 2000) {
      return res.status(400).json({ error: 'Review is too long (max 2000 characters).' });
    }
    if (req.body.website || req.body.url) return res.json({ success: true });

    const flagReasons = flagReview({ reviewer, title, message });

    const review = await Review.create({
      reviewer: reviewer.trim(),
      title: typeof title === 'string' ? title.trim() : '',
      message: typeof message === 'string' ? message.trim() : '',
      starRating: rating,
      productId: decoded.productId,
      orderRefId: String(decoded.orderId),
      source: 'order',
      status: 'pending',
      verified: false,
      verifiedPurchase: true, // the only place this gets set automatically
      flagReasons,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({
      success: true,
      review: {
        _id: review._id,
        status: review.status,
        message: 'Thank you — your review will appear once approved.',
      },
    });
  } catch (err) {
    console.error('[reviews/from-token] submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/reviews/:id/helpful ─────────────────────────────────────
router.post('/:id/helpful', async function(req, res) {
  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, status: 'approved', source: { $ne: 'seed' } },
      { $inc: { helpfulCount: 1 } },
      { new: true, select: 'helpfulCount' }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ helpfulCount: review.helpfulCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
