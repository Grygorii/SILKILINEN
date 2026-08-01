'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const AiVisibility = require('../models/AiVisibility');
const { startRun, PROMPTS, geminiReady, deepseekReady } = require('../services/aiVisibility');

router.use(requireAuth);

// GET / — latest run + a short history for the trend line.
router.get('/', async (req, res) => {
  try {
    const runs = await AiVisibility.find({}).sort({ runAt: -1 }).limit(10)
      .select('runAt completedAt status visibility mentions citations queries competitorShare note').lean();
    res.json({
      providers: { gemini: geminiReady(), deepseek: deepseekReady() },
      promptCount: PROMPTS.length,
      runs,
    });
  } catch (err) {
    console.error('[ai-visibility] list:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /run — start a visibility check (background; poll GET /:id).
router.post('/run', aiLimit, async (req, res) => {
  try {
    const run = await startRun({ triggeredBy: req.user?.email || 'admin' });
    res.status(202).json(run);
  } catch (err) {
    console.error('[ai-visibility] run:', err.message);
    res.status(503).json({ error: err.message || 'Could not start the check — try again.' });
  }
});

// GET /:id — one full run, including per-query results.
router.get('/:id', async (req, res) => {
  try {
    const run = await AiVisibility.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    console.error('[ai-visibility] get:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
