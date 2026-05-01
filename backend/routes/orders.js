const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async function(req, res) {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
