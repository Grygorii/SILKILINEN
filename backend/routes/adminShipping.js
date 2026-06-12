const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getEffectiveRates,
  saveShippingOverrides,
  loadShippingOverrides,
  NUMERIC_FIELDS,
} = require('../services/shipping');

router.use(requireAuth);

// GET /api/admin/shipping-rates — every tier with its defaults and the
// currently effective (possibly overridden) values, for the editor UI.
router.get('/', async function(req, res) {
  try {
    res.json({ tiers: getEffectiveRates() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/shipping-rates — replace the numeric overrides.
// Body: { overrides: { "<tier label>": { cost?, freeThreshold?, deliveryMin?, deliveryMax? } } }
// Only known tier labels and the four numeric fields are accepted; values
// must be finite and non-negative, and deliveryMin must not exceed
// deliveryMax. Country membership is intentionally NOT editable — that's a
// structural change that belongs in code review, not a settings form.
router.put('/', async function(req, res) {
  try {
    const input = req.body?.overrides;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return res.status(400).json({ error: 'overrides object required' });
    }

    const knownLabels = new Set(getEffectiveRates().map(t => t.label));
    const clean = {};

    for (const [label, fields] of Object.entries(input)) {
      if (!knownLabels.has(label)) {
        return res.status(400).json({ error: `Unknown shipping tier: "${label}"` });
      }
      if (!fields || typeof fields !== 'object') continue;
      const entry = {};
      for (const f of NUMERIC_FIELDS) {
        if (fields[f] === undefined || fields[f] === null || fields[f] === '') continue;
        const n = Number(fields[f]);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: `${label}: ${f} must be a non-negative number` });
        }
        entry[f] = n;
      }
      if (entry.deliveryMin !== undefined && entry.deliveryMax !== undefined && entry.deliveryMin > entry.deliveryMax) {
        return res.status(400).json({ error: `${label}: delivery min cannot exceed max` });
      }
      if (Object.keys(entry).length > 0) clean[label] = entry;
    }

    await saveShippingOverrides(clean);
    res.json({ ok: true, tiers: getEffectiveRates() });
  } catch (err) {
    console.error('[adminShipping] save error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/shipping-rates/reset — drop all overrides, back to code defaults.
router.post('/reset', async function(req, res) {
  try {
    await saveShippingOverrides({});
    await loadShippingOverrides();
    res.json({ ok: true, tiers: getEffectiveRates() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
