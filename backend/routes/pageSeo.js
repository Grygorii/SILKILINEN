'use strict';

const express = require('express');
const router = express.Router();
const { getAllPageSeo } = require('../services/pageSeo');

// GET /api/page-seo — public; the static pages read their meta override here.
router.get('/', function(req, res) {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.json(getAllPageSeo());
});

module.exports = router;
