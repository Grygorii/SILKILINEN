const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const GrowthAction = require('../models/GrowthAction');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const { runGrowthEngine, setAgentEnabled, describeAgents } = require('../services/growthEngine');
const { getCompetitors, setCompetitors } = require('../services/competitorIntel');
const { discoverCompetitors } = require('../services/competitorDiscovery');
const CEOBrief = require('../models/CEOBrief');
const { getNorthStar, setNorthStar, northStarStatus, generateBrief, runChiefIfDue, METRICS } = require('../services/chiefOfStaff');
const { unleashDaVinci, latestComposition } = require('../services/davinci');
const { runSelfTest } = require('../services/selfTest');

// Da Vinci runs the orchestra — its own tight limit so it can't be hammered.
const davinciLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });

// Manual runs invoke AI; keep a sane lid on a stuck refresh-spammer.
const runLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });
// The brief is the founder's main interaction — give it its own roomier limit
// so trying a few times in a row never trips a shared "run" cap.
const briefLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

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

function escapeRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// GET /api/admin/growth/hermes-plan — Hermes' latest plays resolved into an
// executable chain for the Rebuild SEO pipeline. Dedupes by entity and resolves
// each ref to a real product/category/collection id so the pipeline can act.
router.get('/hermes-plan', async function(req, res) {
  try {
    const actions = await GrowthAction.find({
      agent: 'hermes', type: 'seo', 'meta.entityType': { $exists: true },
    }).sort({ createdAt: -1 }).limit(20).lean();

    const seen = new Set();
    const plan = [];
    for (const a of actions) {
      const m = a.meta || {};
      if (!m.entityRef) continue;
      const key = `${m.entityType}:${String(m.entityRef).toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let entityId = null, slug = null, label = m.entityRef;
      if (m.entityType === 'product') {
        const p = await Product.findOne({ name: new RegExp(`^${escapeRx(m.entityRef)}$`, 'i') }).select('name').lean();
        if (p) { entityId = String(p._id); label = p.name; }
      } else if (m.entityType === 'category') {
        const c = await Category.findOne({ $or: [{ slug: m.entityRef }, { label: m.entityRef }] }).select('slug label').lean();
        if (c) { entityId = String(c._id); slug = c.slug; label = c.label; }
      } else if (m.entityType === 'collection') {
        const c = await Collection.findOne({ $or: [{ slug: m.entityRef }, { name: m.entityRef }] }).select('slug name').lean();
        if (c) { entityId = String(c._id); slug = c.slug; label = c.name; }
      }

      plan.push({
        ref: String(a._id).slice(-8),
        kind: m.kind === 'content' ? 'content' : 'meta',
        entityType: m.entityType,
        entityId, slug, label,
        target: m.target || '',
        action: m.action || a.detail || '',
        leverage: m.leverage || 'low',
        // The pipeline can auto-generate+apply only meta on a resolved entity.
        applicable: m.kind === 'meta' && entityId != null,
      });
      if (plan.length >= 12) break;
    }

    res.json({ plan });
  } catch (err) {
    console.error('[growth] hermes-plan error:', err.message);
    res.status(500).json({ error: 'Could not build the plan.' });
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

// GET /api/admin/growth/competitors — the list the Competitor Scout studies.
router.get('/competitors', async function(req, res) {
  try {
    res.json({ competitors: await getCompetitors() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/growth/competitors  { competitors: [{ name, domain }] }
router.put('/competitors', async function(req, res) {
  try {
    const competitors = await setCompetitors(req.body?.competitors);
    res.json({ ok: true, competitors });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/growth/competitors/discover — let the AI find rival brands
// across every shipping market, verify they're live, and merge them in.
router.post('/competitors/discover', runLimit, async function(req, res) {
  try {
    const result = await discoverCompetitors();
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, ...result, competitors: await getCompetitors() });
  } catch (err) {
    console.error('[growth] discover error:', err.message);
    res.status(500).json({ error: 'Discovery failed — try again.' });
  }
});

// GET /api/admin/growth/brain — North Star, metric options, latest Co-CEO brief.
router.get('/brain', async function(req, res) {
  try {
    const [northStar, status, brief, composition] = await Promise.all([
      getNorthStar(),
      northStarStatus(),
      CEOBrief.findOne().sort({ createdAt: -1 }).lean(),
      latestComposition(),
    ]);
    res.json({
      northStar,
      status,
      metrics: Object.entries(METRICS).map(([k, v]) => ({ key: k, ...v })),
      brief: brief || null,
      composition: composition || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/growth/north-star  { metric, target, deadline?, note? }
router.put('/north-star', async function(req, res) {
  try {
    const ns = await setNorthStar(req.body || {});
    res.json({ ok: true, northStar: ns });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/growth/action/:id — the full action for the Review room.
router.get('/action/:id', async function(req, res) {
  try {
    const action = await GrowthAction.findById(req.params.id).lean();
    if (!action) return res.status(404).json({ error: 'Not found' });
    res.json({ action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/growth/action/:id/decide { outcome, reason }
// Records the founder's verdict (kept forever) and turns their reason into a
// Playbook learning the agents read next time — +1 to our shared intellect.
router.post('/action/:id/decide', async function(req, res) {
  try {
    const { outcome, reason } = req.body || {};
    if (!['completed', 'rejected'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be completed or rejected' });
    }
    const action = await GrowthAction.findById(req.params.id);
    if (!action) return res.status(404).json({ error: 'Not found' });

    action.status = outcome;
    action.decision = { outcome, reason: String(reason || '').slice(0, 600), decidedAt: new Date() };
    await action.save();

    // The reason becomes memory. Phrase it as a durable rule for the agents.
    if (reason && String(reason).trim()) {
      const { addLearning } = require('../services/playbook');
      const verb = outcome === 'completed' ? 'Founder approved' : 'Founder rejected';
      await addLearning(`${verb} "${action.title}" — ${String(reason).trim()}`).catch(() => {});
    }
    res.json({ ok: true, action });
  } catch (err) {
    console.error('[growth] decide error:', err.message);
    res.status(500).json({ error: 'Could not save your decision.' });
  }
});

// GET /api/admin/growth/self-test — ping every dependency + report agents.
router.get('/self-test', async function(req, res) {
  try {
    res.json(await runSelfTest());
  } catch (err) {
    console.error('[growth] self-test error:', err.message);
    res.status(500).json({ error: 'Self-test could not run.' });
  }
});

// POST /api/admin/growth/davinci — unleash the conductor. Fires the full
// orchestra in the background and composes the masterwork from the desk.
router.post('/davinci', davinciLimit, async function(req, res) {
  try {
    const result = await unleashDaVinci();
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, composition: result.composition });
  } catch (err) {
    console.error('[growth] davinci error:', err.message);
    res.status(500).json({ error: 'Da Vinci stumbled — try unleashing again.' });
  }
});

// POST /api/admin/growth/brief — generate a fresh Co-CEO brief now.
router.post('/brief', briefLimit, async function(req, res) {
  try {
    const result = await generateBrief();
    if (result.skipped) return res.status(400).json({ error: result.skipped });
    res.json({ ok: true, brief: result.brief });
  } catch (err) {
    console.error('[growth] brief error:', err.message);
    res.status(500).json({ error: 'Could not generate the brief — try again.' });
  }
});

module.exports = router;
module.exports.runChiefIfDue = runChiefIfDue;
