const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { stats, remember, summarizeReference, addReference, listReferences, removeReference } = require('../services/archivarius');

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

// ── Library — founder-curated references (links / books) ─────────────────────

// GET /library — list the saved references.
router.get('/library', async (req, res) => {
  try { res.json(await listReferences()); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /library/summarize — fetch a URL + distil it into principles (preview,
// so the founder can edit before saving).
router.post('/library/summarize', async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Enter a valid http(s) URL.' });
    res.json(await summarizeReference(url));
  } catch (err) { res.status(400).json({ error: err.message || 'Could not summarize the link.' }); }
});

// POST /library — save a reference (link or book).
router.post('/library', async (req, res) => {
  try {
    const { title, refType, refSource, text, tags } = req.body || {};
    if (!String(text || '').trim()) return res.status(400).json({ error: 'Add the key principles/takeaways for the agents to apply.' });
    await addReference({
      title, refType, refSource, text,
      tags: Array.isArray(tags) ? tags : String(tags || '').split(',').map(t => t.trim()).filter(Boolean),
      source: req.user?.email || 'founder',
    });
    res.status(201).json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /library/:id — remove a reference.
router.delete('/library/:id', async (req, res) => {
  try { await removeReference(req.params.id); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
