const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const JournalArticle = require('../models/JournalArticle');

router.use(requireAuth);

// ── GET / — list all articles ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const articles = await JournalArticle.find(filter)
      .sort({ updatedAt: -1 })
      .select('title slug excerpt status heroImage publishedAt readingTimeMinutes updatedAt author')
      .lean();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — create new article ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const article = await JournalArticle.create({ title, status: 'draft' });
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id — full article ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const article = await JournalArticle.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id — full save ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['title', 'slug', 'excerpt', 'body', 'heroImage', 'author', 'status',
      'scheduledFor', 'metaTitle', 'metaDescription', 'keywords', 'lastEditedBy'];
    const update = {};
    for (const k of allowed) {
      if (k in req.body) update[k] = req.body[k];
    }
    // Sync publishedAt when publishing for the first time
    if (update.status === 'published') {
      const existing = await JournalArticle.findById(req.params.id).select('publishedAt status').lean();
      if (existing && !existing.publishedAt) update.publishedAt = new Date();
    }
    update.updatedAt = new Date();
    const article = await JournalArticle.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/autosave — lightweight body-only save ────────────────────────────
router.post('/:id/autosave', async (req, res) => {
  try {
    const { title, excerpt, body } = req.body;
    const update = { updatedAt: new Date() };
    if (title !== undefined) update.title = title;
    if (excerpt !== undefined) update.excerpt = excerpt;
    if (body !== undefined) update.body = body;
    await JournalArticle.findByIdAndUpdate(req.params.id, { $set: update });
    res.json({ saved: true, savedAt: update.updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/preview-token — issue 1hr signed JWT for preview URL ──────────────
router.get('/:id/preview-token', async (req, res) => {
  try {
    const article = await JournalArticle.findById(req.params.id).select('_id').lean();
    if (!article) return res.status(404).json({ error: 'Not found' });
    const token = jwt.sign({ articleId: req.params.id, type: 'journal_preview' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await JournalArticle.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
