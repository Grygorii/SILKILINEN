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
const { getQueryOpportunities } = require('../services/searchConsole');
const { generatePageCopy, AIServiceError } = require('../services/aiText');
const { EDITABLE_PATHS } = require('../services/pageSeo');

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

    // The Clerks' check, applied to Hermes' plan before you execute it:
    // Reasoning — is the cited query actually in current Search Console?
    // (live GSC queries, lowercased). Fails soft: thin signal → skip the check.
    const liveOpps = await getQueryOpportunities(28).catch(() => []);
    const liveQueries = (liveOpps || []).map(o => String(o.query || '').toLowerCase());

    const seen = new Set();
    const plan = [];
    for (const a of actions) {
      const m = a.meta || {};
      if (!m.entityRef) continue;
      const key = `${m.entityType}:${String(m.entityRef).toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const warnings = [];
      let entityId = null, slug = null, label = m.entityRef;
      if (m.entityType === 'product') {
        const p = await Product.findOne({ name: new RegExp(`^${escapeRx(m.entityRef)}$`, 'i') })
          .select('name status totalStock inStock').lean();
        if (p) {
          entityId = String(p._id); label = p.name;
          // Logic check: don't optimise a sold-out or inactive product.
          const stocked = p.inStock ?? ((p.totalStock || 0) > 0);
          if (p.status && p.status !== 'active') warnings.push('product is not active');
          else if (!stocked) warnings.push('product is out of stock');
        }
      } else if (m.entityType === 'category') {
        const c = await Category.findOne({ $or: [{ slug: m.entityRef }, { label: m.entityRef }] }).select('slug label').lean();
        if (c) { entityId = String(c._id); slug = c.slug; label = c.label; }
      } else if (m.entityType === 'collection') {
        const c = await Collection.findOne({ $or: [{ slug: m.entityRef }, { name: m.entityRef }] }).select('slug name').lean();
        if (c) { entityId = String(c._id); slug = c.slug; label = c.name; }
      } else if (m.entityType === 'page') {
        // Static pages can now be fixed too — meta lives in the editable
        // pageSeo store, keyed by path. entityId carries the path.
        if (EDITABLE_PATHS.includes(m.entityRef)) { entityId = m.entityRef; label = m.entityRef; }
      }

      // Logic check: did the entity actually resolve?
      if (m.entityType !== 'page' && entityId == null) warnings.push(`couldn't match a ${m.entityType} named "${m.entityRef}"`);
      else if (m.entityType === 'page' && entityId == null) warnings.push(`"${m.entityRef}" is not an editable page`);
      // Reasoning check: is the cited query really in current Search Console?
      const t = String(m.target || '').toLowerCase().trim();
      if (t && liveQueries.length && !liveQueries.some(q => q === t || q.includes(t) || t.includes(q))) {
        warnings.push('this query isn’t in current Search Console — verify before acting');
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
        // The Clerks' verdict on THIS recommendation, before you act on it.
        verified: warnings.length === 0,
        warnings,
      });
      if (plan.length >= 12) break;
    }

    res.json({ plan });
  } catch (err) {
    console.error('[growth] hermes-plan error:', err.message);
    res.status(500).json({ error: 'Could not build the plan.' });
  }
});

// POST /api/admin/growth/draft-copy — turn a Hermes "content" finding into a
// real brand-voice paragraph the founder can place (no overwrite). { entityType,
// entityId, guidance }
router.post('/draft-copy', runLimit, async function(req, res) {
  try {
    const { entityType, entityId, guidance } = req.body || {};
    let name = '', current = '', items = [];
    if (entityType === 'product') {
      const p = await Product.findById(entityId).select('name description').lean();
      if (!p) return res.status(404).json({ error: 'Not found' });
      name = p.name; current = p.description || '';
    } else if (entityType === 'category') {
      const c = await Category.findById(entityId).select('label slug description').lean();
      if (!c) return res.status(404).json({ error: 'Not found' });
      name = c.label; current = c.description || '';
      items = (await Product.find({ category: c.slug, status: 'active' }).select('name').limit(10).lean()).map(p => p.name);
    } else if (entityType === 'collection') {
      const c = await Collection.findById(entityId).select('name description').lean();
      if (!c) return res.status(404).json({ error: 'Not found' });
      name = c.name; current = c.description || '';
      items = (await Product.find({ collections: entityId, status: 'active' }).select('name').limit(10).lean()).map(p => p.name);
    } else {
      return res.status(400).json({ error: 'Unsupported entity for copy drafting' });
    }
    const { copy } = await generatePageCopy({ kind: entityType, name, current, guidance: guidance || '', items });
    res.json({ copy });
  } catch (err) {
    console.error('[growth] draft-copy error:', err.message);
    if (err instanceof AIServiceError) return res.status(503).json({ error: 'AI copy drafting is temporarily unavailable.' });
    res.status(500).json({ error: 'Could not draft copy.' });
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
