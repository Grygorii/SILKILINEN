const express = require('express');
const router = express.Router();
const Review = require('../models/Review');

// All verified reviews, 3+ stars, newest first
router.get('/', async function(req, res) {
  try {
    const reviews = await Review.find({
      verified: true,
      starRating: { $gte: 3 },
    })
      .sort({ dateReviewed: -1 })
      .select('-__v');

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
