const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { stats, remember } = require('../services/archivarius');

router.use(requireAuth);

// GET / — the state of the house memory.
router.get('/', async (req, res) => {
  try { res.json(await stats()); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST / — the founder teaches Archivarius a fact or a decision to honour.
router.post('/', async (req, res) => {
  try {
    const { kind, text, detail, tags } = req.body || {};
    const allowed = ['fact', 'decision', 'lesson', 'pitfall'].includes(kind) ? kind : 'decision';
    const entry = await remember({ kind: allowed, text, detail, source: req.user?.email || 'founder', tags: Array.isArray(tags) ? tags : [] });
    if (!entry) return res.status(400).json({ error: 'Nothing added — empty, too short, or already known (it was reinforced).' });
    res.status(201).json(entry);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
