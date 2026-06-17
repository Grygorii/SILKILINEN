'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const { savePageSeo, EDITABLE_PATHS } = require('../services/pageSeo');
const { generateSEO, AIServiceError } = require('../services/aiText');

router.use(requireAuth);

// POST /api/admin/page-seo/generate — draft meta for a static page (no save).
router.post('/generate', aiLimit, async function(req, res) {
  try {
    const { path, label, guidance } = req.body || {};
    if (!EDITABLE_PATHS.includes(String(path))) return res.status(400).json({ error: 'Not an editable page path' });
    const seo = await generateSEO({ kind: 'page', name: label || path, guidance: guidance || '' });
    res.json({ seo: { metaTitle: seo.metaTitle, metaDescription: seo.metaDescription } });
  } catch (err) {
    console.error('[page-seo generate] error:', err.message);
    if (err instanceof AIServiceError) return res.status(503).json({ error: 'AI generation temporarily unavailable.' });
    res.status(500).json({ error: 'Could not generate page SEO.' });
  }
});

// PATCH /api/admin/page-seo — save a page's meta override.
router.patch('/', async function(req, res) {
  try {
    const { path, metaTitle, metaDescription } = req.body || {};
    const saved = await savePageSeo(path, { metaTitle, metaDescription });
    // Editable pages are always live — instant-index the updated path.
    if (EDITABLE_PATHS.includes(String(path))) require('../services/indexNow').pingIndexNow(String(path));
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
