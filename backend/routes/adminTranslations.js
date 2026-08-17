'use strict';

// Admin surface for the translation engine. Run generates AI translations for
// the catalogue into every supported locale (skipping what's already done and
// never touching manual edits); PATCH saves a founder's manual override; GET
// reports coverage and returns a single resource's translations for editing.

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const Translation = require('../models/Translation');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const { SUPPORTED, LOCALES, configured, translateResource, upsertTranslation } = require('../services/translator');

router.use(requireAuth);

// GET / — coverage summary: how much of the catalogue is translated per locale.
router.get('/', async (req, res) => {
  try {
    // Count translations only for resources that STILL COUNT toward the total.
    //
    // The denominator was active-only while the numerator was every translation
    // row ever written, including resources since archived. Six archived
    // categories had been translated before archiving, so the panel read
    // "Categories 12/6" and the overall coverage showed 118% — a progress bar
    // past full, which tells the founder nothing except that the number is
    // wrong. Restricting the numerator to live ids makes both halves describe
    // the same set.
    const [liveProducts, liveCategories, liveCollections] = await Promise.all([
      Product.find({ status: { $in: ['active', 'sold_out'] } }).select('_id').lean(),
      Category.find({ status: 'active' }).select('_id').lean(),
      Collection.find({ status: 'active' }).select('_id').lean(),
    ]);
    const liveIds = {
      product: liveProducts.map(d => String(d._id)),
      category: liveCategories.map(d => String(d._id)),
      collection: liveCollections.map(d => String(d._id)),
    };
    const products = liveIds.product.length;
    const categories = liveIds.category.length;
    const collections = liveIds.collection.length;

    const byLocale = await Translation.aggregate([
      {
        $match: {
          $or: Object.entries(liveIds).map(([type, ids]) => ({
            resourceType: type,
            // Stored as ObjectId or string depending on writer; match both.
            $expr: { $in: [{ $toString: '$resourceId' }, ids] },
          })),
        },
      },
      // DISTINCT resource per locale/type: a resource with several translated
      // FIELDS is still one translated resource, and counting rows inflated it.
      { $group: { _id: { locale: '$locale', type: '$resourceType', rid: { $toString: '$resourceId' } } } },
      { $group: { _id: { locale: '$_id.locale', type: '$_id.type' }, n: { $sum: 1 } } },
    ]);
    const translated = {};
    for (const row of byLocale) {
      translated[row._id.locale] = translated[row._id.locale] || {};
      translated[row._id.locale][row._id.type] = row.n;
    }
    res.json({ configured: configured(), locales: SUPPORTED, sourceCounts: { product: products, category: categories, collection: collections }, translated });
  } catch (err) {
    console.error('[translations] summary:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /run — translate MISSING catalogue content into all locales. Capped per
// run (each product = up to 4 AI calls) so the quota survives one click; re-run
// to continue. { force:true } re-translates AI values (still never manual ones).
router.post('/run', aiLimit, async (req, res) => {
  if (!configured()) return res.json({ ran: false, note: 'Set DEEPSEEK_API_KEY in Railway to enable translation.' });
  const productLimit = Math.min(Number(req.body?.limit) || 40, 80);
  const force = Boolean(req.body?.force);
  const tally = { translated: 0, exists: 0, keptManual: 0, failed: 0 };
  const bump = (r) => { for (const v of Object.values(r)) {
    if (v === 'translated') tally.translated++;
    else if (v === 'kept-manual') tally.keptManual++;
    else if (String(v).startsWith('error')) tally.failed++;
    else tally.exists++;
  } };

  try {
    const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
      .select('name description metaTitle metaDescription').sort({ updatedAt: -1 }).limit(productLimit);
    for (const p of products) {
      bump(await translateResource('product', p._id,
        { name: p.name, description: p.description, metaTitle: p.metaTitle, metaDescription: p.metaDescription }, { force }));
    }
    // Categories + collections are few — translate all of them each run.
    for (const c of await Category.find({ status: 'active' }).select('label description metaTitle metaDescription')) {
      bump(await translateResource('category', c._id,
        { label: c.label, description: c.description, metaTitle: c.metaTitle, metaDescription: c.metaDescription }, { force }));
    }
    for (const c of await Collection.find({ status: 'active' }).select('name description metaTitle metaDescription')) {
      bump(await translateResource('collection', c._id,
        { name: c.name, description: c.description, metaTitle: c.metaTitle, metaDescription: c.metaDescription }, { force }));
    }
    res.json({ ran: true, ...tally, productsScanned: products.length, hitLimit: products.length >= productLimit });
  } catch (err) {
    console.error('[translations] run:', err.message);
    res.status(503).json({ error: err.message || 'Translation run failed' });
  }
});

// GET /:type/:id — one resource's translations across locales (for the editor).
router.get('/:type/:id', async (req, res) => {
  try {
    const rows = await Translation.find({ resourceType: req.params.type, resourceId: String(req.params.id) }).lean();
    res.json(Object.fromEntries(rows.map(r => [r.locale, { fields: r.fields || {}, source: r.source }])));
  } catch (err) {
    console.error('[translations] get:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH / — save a founder's manual translation (locks it from AI overwrite).
router.patch('/', async (req, res) => {
  try {
    const { resourceType, resourceId, locale, fields } = req.body || {};
    if (!LOCALES.includes(locale)) return res.status(400).json({ error: 'Unsupported locale' });
    const doc = await upsertTranslation(resourceType, resourceId, locale, fields || {}, 'manual');
    res.json({ ok: true, fields: doc.fields, source: doc.source });
  } catch (err) {
    console.error('[translations] save:', err.message);
    res.status(500).json({ error: err.message || 'Save failed' });
  }
});

module.exports = router;
