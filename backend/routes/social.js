const express = require('express');
const router = express.Router();
const SocialPlatform = require('../models/SocialPlatform');

// GET /api/social/platforms — public; returns only active platforms that have a URL set
router.get('/platforms', async (req, res) => {
  try {
    const platforms = await SocialPlatform.find({ isActive: true, url: { $ne: '' } })
      .sort({ sortOrder: 1, displayName: 1 })
      .select('key displayName icon brandColor url')
      .lean();
    res.json(platforms);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
