'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const BotHit = require('../models/BotHit');

// Who is crawling the shop, and what they read.
//
// This is not vanity. Three of these numbers are decisions:
//   Googlebot at zero on a page means it is not being crawled, whatever the
//     sitemap says.
//   GPTBot / ClaudeBot / PerplexityBot is whether AI search can see the
//     catalogue at all — increasingly where "silk robe" gets answered.
//   Ahrefs / Semrush volume is competitors watching, which is worth knowing
//     before a pricing change.
//
// Read-only, and it reads its OWN collection: nothing here can affect the
// Visit aggregations the funnel and advisor depend on.

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90; // matches the TTL — older data does not exist

router.get('/', requireAuth, async function (req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || DEFAULT_DAYS, 1), MAX_DAYS);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byBot, byPage, total] = await Promise.all([
      BotHit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$bot', hits: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
        { $project: { _id: 0, bot: '$_id', hits: 1, lastSeen: 1 } },
        { $sort: { hits: -1 } },
      ]),
      BotHit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$page', hits: { $sum: 1 } } },
        { $project: { _id: 0, page: '$_id', hits: 1 } },
        { $sort: { hits: -1 } },
        { $limit: 10 },
      ]),
      BotHit.countDocuments({ createdAt: { $gte: since } }),
    ]);

    // An empty result has two meanings and they are opposite: nothing has been
    // recorded YET (this shipped on 9 Sept 2026 — before that, bots were
    // identified and discarded), or crawlers genuinely stopped coming. Say
    // which, rather than letting a zero read as "nobody is crawling us".
    res.json({ days, total, byBot, byPage, collecting: total > 0 });
  } catch (err) {
    console.error('[bot-traffic]', err.message);
    res.status(500).json({ error: 'Could not read crawler traffic' });
  }
});

module.exports = router;
