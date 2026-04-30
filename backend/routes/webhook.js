const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

// express.raw() is applied here so this route receives the raw buffer Stripe needs
// for signature verification — do NOT add express.json() before this route in server.js.
router.post('/', express.raw({ type: 'application/json' }), async function(req, res) {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await Order.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          status: 'paid',
          customerEmail: session.customer_details?.email ?? null,
        }
      );
    } catch (err) {
      console.error('Failed to update order:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;
