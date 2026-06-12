const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const GrowthAction = require('../models/GrowthAction');
const { runGrowthEngine, setAgentEnabled, describeAgents } = require('../services/growthEngine');

// Manual runs invoke AI; keep a sane lid on a stuck refresh-spammer.
const runLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });

router.use(requireAuth);

// GET /api/admin/growth — agents (with toggles + last run) and the pulse feed.
router.get('/', async function(req, res) {
  try {
    const [agents, actions] = await Promise.all([
      describeAgents(),
      GrowthAction.find().sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.json({ agents, actions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/growth/settings  { agent, enabled }
router.put('/settings', async function(req, res) {
  try {
    const { agent, enabled } = req.body;
    await setAgentEnabled(agent, enabled);
    res.json({ ok: true, agents: await describeAgents() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/growth/run  { agent? } — run now (all enabled, or one).
router.post('/run', runLimit, async function(req, res) {
  try {
    const result = await runGrowthEngine({ force: true, only: req.body?.agent || null });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[growth] manual run error:', err.message);
    res.status(500).json({ error: 'Run failed — check the backend logs.' });
  }
});

module.exports = router;
