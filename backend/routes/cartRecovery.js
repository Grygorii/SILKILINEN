const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { verify: verifyUnsub } = require('../utils/unsubscribeSign');

// GET /api/cart-recovery/unsubscribe?oid=<base64url-orderId>&sig=<hmac>
// One-click unsubscribe from cart recovery emails for this order. The HMAC sig
// makes the link unforgeable so nobody can unsubscribe another customer's order.
router.get('/unsubscribe', async function(req, res) {
  try {
    const { oid, sig } = req.query;
    if (typeof oid !== 'string' || !oid) return res.status(400).send('Missing order reference.');

    const orderId = Buffer.from(oid, 'base64url').toString('utf8');
    if (!verifyUnsub(orderId, sig)) return res.status(403).send('This link is invalid.');
    const order = await Order.findById(orderId).select('_id recoveryUnsubscribed');
    if (!order) return res.status(404).send('Order not found.');

    if (!order.recoveryUnsubscribed) {
      await Order.updateOne({ _id: order._id }, { $set: { recoveryUnsubscribed: true } });
    }

    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — SILKILINEN</title>
<style>body{margin:0;padding:40px 16px;background:#f0ede8;font-family:Helvetica,Arial,sans-serif;text-align:center;}
h1{font-family:Georgia,serif;font-weight:400;font-size:28px;color:#1a1916;letter-spacing:4px;}
p{font-size:14px;color:#5a5650;line-height:1.8;max-width:400px;margin:16px auto 0;}
a{color:#1a1916;}
</style></head>
<body>
<p style="font-family:Georgia,serif;font-size:18px;letter-spacing:6px;color:#1a1916;">SILKILINEN</p>
<h1>Unsubscribed</h1>
<p>You won't receive any more cart reminder emails from us. You'll still get order confirmation and shipping updates for any purchases.</p>
<p style="margin-top:24px;"><a href="https://silkilinen.com">Return to the shop</a></p>
</body></html>`);
  } catch (err) {
    console.error('[cart-recovery unsubscribe]', err.message);
    res.status(500).send('Something went wrong. Please try again.');
  }
});

module.exports = router;
