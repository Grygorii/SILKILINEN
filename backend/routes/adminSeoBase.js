'use strict';

// THE SEO BASE — one place that lists every indexable URL on the site with its
// meta title + description, wherever that meta actually lives (product docs,
// category docs, collection docs, or the static-page override store). It's the
// founder's "site plan": read the whole shop's SEO at a glance, spot gaps by
// colour, and edit any line — the save routes the change back to the right store.
// Read-only aggregation + a single PATCH; the AI writers live elsewhere.

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const { getPageSeo, savePageSeo, EDITABLE_PATHS } = require('../services/pageSeo');

router.use(requireAuth);

const SITE = 'https://www.silkilinen.com';

// Snippet-length health, mirroring Google's rough display limits. Returns
// 'good' | 'warn' | 'bad' so the UI can colour each cell without duplicating
// the thresholds on the frontend.
function titleHealth(t) {
  const n = (t || '').trim().length;
  if (n === 0) return 'bad';
  if (n > 60) return 'warn';        // risks truncation
  if (n < 25) return 'warn';        // too thin
  return 'good';
}
function descHealth(d) {
  const n = (d || '').trim().length;
  if (n === 0) return 'bad';
  if (n > 160) return 'warn';       // clamped in-render, but flag it
  if (n < 70) return 'warn';        // too short to be useful
  return 'good';
}

function row({ type, id, label, url, title, description, note }) {
  const t = String(title || ''), d = String(description || '');
  return {
    type, id, label, url,
    title: t, titleLen: t.trim().length, titleHealth: titleHealth(t),
    description: d, descLen: d.trim().length, descHealth: descHealth(d),
    note: note || '',
  };
}

// GET / — the whole site plan, grouped by type.
router.get('/', async (req, res) => {
  try {
    const [products, categories, collections] = await Promise.all([
      Product.find({ status: { $in: ['active', 'sold_out'] } })
        .select('name slug metaTitle metaDescription').sort({ updatedAt: -1 }).lean(),
      Category.find({ status: 'active' }).select('label slug metaTitle metaDescription').sort({ label: 1 }).lean(),
      Collection.find({ status: 'active' }).select('name slug metaTitle metaDescription').sort({ name: 1 }).lean(),
    ]);

    const rows = [];

    // Static pages — their real meta has a code fallback, so an empty override
    // isn't "missing", it's "using the built-in default". Flag that as a note,
    // not a red gap.
    for (const path of EDITABLE_PATHS) {
      const o = getPageSeo(path) || {};
      const hasOverride = Boolean(o.metaTitle || o.metaDescription);
      rows.push(row({
        type: 'page', id: path, label: path === '/' ? 'Homepage' : path,
        url: `${SITE}${path === '/' ? '' : path}`,
        title: o.metaTitle || '', description: o.metaDescription || '',
        note: hasOverride ? '' : 'Using the built-in default until you set one here.',
      }));
    }

    for (const p of products) {
      rows.push(row({
        type: 'product', id: String(p._id), label: p.name,
        url: `${SITE}/product/${p.slug || p._id}`,
        title: p.metaTitle || '', description: p.metaDescription || '',
      }));
    }
    for (const c of categories) {
      rows.push(row({
        type: 'category', id: String(c._id), label: c.label,
        url: `${SITE}/shop?category=${c.slug}`,
        title: c.metaTitle || '', description: c.metaDescription || '',
      }));
    }
    for (const c of collections) {
      rows.push(row({
        type: 'collection', id: String(c._id), label: c.name,
        url: `${SITE}/collections/${c.slug}`,
        title: c.metaTitle || '', description: c.metaDescription || '',
      }));
    }

    // Headline counts so the page can show "18 of 92 need attention" at a glance.
    const needsWork = rows.filter(r => r.titleHealth === 'bad' || r.descHealth === 'bad').length;
    res.json({ total: rows.length, needsWork, rows });
  } catch (err) {
    console.error('[seo-base] list:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH / — save one edited row back to whichever store owns it.
router.patch('/', async (req, res) => {
  try {
    const { type, id } = req.body || {};
    const metaTitle = String(req.body?.metaTitle || '').slice(0, 70);
    const metaDescription = String(req.body?.metaDescription || '').slice(0, 165);

    if (type === 'page') {
      if (!EDITABLE_PATHS.includes(id)) return res.status(400).json({ error: 'Unknown page path' });
      const saved = await savePageSeo(id, { metaTitle, metaDescription });
      return res.json({ ok: true, metaTitle: saved.metaTitle, metaDescription: saved.metaDescription });
    }

    const Model = { product: Product, category: Category, collection: Collection }[type];
    if (!Model) return res.status(400).json({ error: 'Unknown type' });
    const doc = await Model.findByIdAndUpdate(id, { metaTitle, metaDescription }, { new: true, runValidators: true })
      .select('metaTitle metaDescription').lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, metaTitle: doc.metaTitle || '', metaDescription: doc.metaDescription || '' });
  } catch (err) {
    console.error('[seo-base] save:', err.message);
    res.status(500).json({ error: err.message || 'Save failed' });
  }
});

module.exports = router;
