const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const MarketingPlan = require('../models/MarketingPlan');
const { coordinate, weeklyCoordinator } = require('../services/marketingCoordinator');

router.use(requireAuth);

// POST / — interactive: a brief → one coordinated plan.
router.post('/', aiLimit, async (req, res) => {
  try {
    const plan = await coordinate({ goal: req.body?.goal, focus: req.body?.focus, triggeredBy: req.user?.email || 'admin' });
    res.status(201).json(plan);
  } catch (err) {
    console.error('[coordinator] create:', err.message);
    res.status(err.message?.includes('required') || err.message?.includes('configured') ? 400 : 503)
      .json({ error: err.message || 'Could not build a plan — try again.' });
  }
});

// GET / — recent plans.
router.get('/', async (req, res) => {
  try {
    const plans = await MarketingPlan.find({}).sort({ createdAt: -1 }).limit(20).lean();
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — one plan.
router.get('/:id', async (req, res) => {
  try {
    const plan = await MarketingPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ error: 'Not found' });
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/task/:taskId — tick a task done (track execution).
router.patch('/:id/task/:taskId', async (req, res) => {
  try {
    const plan = await MarketingPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    let found = false;
    for (const play of plan.plays) {
      const task = play.tasks.id(req.params.taskId);
      if (task) { task.done = Boolean(req.body?.done); found = true; break; }
    }
    if (!found) return res.status(404).json({ error: 'Task not found' });
    // All tasks done → mark the plan done.
    const allDone = plan.plays.every(p => p.tasks.every(t => t.done));
    if (allDone && plan.plays.some(p => p.tasks.length)) plan.status = 'done';
    else if (plan.status === 'done') plan.status = 'active';
    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /weekly — manually trigger the autonomous weekly plan (also runs on cron).
router.post('/weekly', aiLimit, async (req, res) => {
  try {
    const result = await weeklyCoordinator({ force: true });
    res.json(result);
  } catch (err) {
    console.error('[coordinator] weekly:', err.message);
    res.status(503).json({ error: err.message || 'Could not run the weekly coordinator.' });
  }
});

module.exports = router;
