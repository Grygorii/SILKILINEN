const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { ask } = require('../services/analyst');

// Each question = 2 AI calls + a handful of aggregations. 30/hour is far
// beyond a founder's natural rhythm but caps a runaway loop's cost.
const analystLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);

// POST /api/admin/analyst/ask  { question, history?: [{role, content}] }
router.post('/ask', analystLimit, async function(req, res) {
  try {
    const { question, history } = req.body;
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'A question is required' });
    }
    const result = await ask(String(question).trim(), history);
    res.json(result);
  } catch (err) {
    console.error('[analyst] ask error:', err.message);
    res.status(500).json({ error: 'The analyst hit an error — try again in a moment.' });
  }
});

module.exports = router;
