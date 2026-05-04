'use strict';

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { CATEGORIES } = require('../config/categories');

router.get('/', async function(req, res) {
  try {
    const counts = await Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out', null, undefined] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });

    const result = CATEGORIES.map(cat => ({
      slug: cat.slug,
      label: cat.label,
      count: countMap[cat.slug] || 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
