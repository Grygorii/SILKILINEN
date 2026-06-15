const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const JournalArticle = require('../models/JournalArticle');

// ── GET / — published articles (homepage + public index) ──────────────────────
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const articles = await JournalArticle.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('title slug excerpt heroImage publishedAt readingTimeMinutes author')
      .lean();
    res.json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /slug/:slug — individual published article ─────────────────────────────
router.get('/slug/:slug', async (req, res) => {
  try {
    const article = await JournalArticle.findOne({ slug: req.params.slug, status: 'published' }).lean();
    if (!article) return res.status(404).json({ error: 'Not found' });
    // Increment view count (fire-and-forget)
    JournalArticle.findByIdAndUpdate(article._id, { $inc: { viewCount: 1 } }).exec();
    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /preview — article via signed JWT token ───────────────────────────────
router.get('/preview', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const payload = jwt.verify(String(token), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.type !== 'journal_preview') return res.status(401).json({ error: 'Invalid token' });
    const article = await JournalArticle.findById(payload.articleId).lean();
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

module.exports = router;
