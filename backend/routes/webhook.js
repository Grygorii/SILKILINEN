const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { sendOrderConfirmation, sendAdminOrderNotification } = require('../services/email');

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
      const addr = session.shipping_details?.address ?? session.customer_details?.address ?? null;

      // Resolve shipping rate display name if a shipping option was chosen
      let shippingMethod = null;
      let shippingCost = 0;
      if (session.shipping_cost) {
        shippingCost = (session.shipping_cost.amount_total ?? 0) / 100;
        if (session.shipping_cost.shipping_rate) {
          try {
            const rate = await stripe.shippingRates.retrieve(session.shipping_cost.shipping_rate);
            shippingMethod = rate.display_name ?? null;
          } catch {
            // non-critical — store cost without method name
          }
        }
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          status: 'paid',
          customerEmail: session.customer_details?.email ?? null,
          customerName: session.customer_details?.name ?? null,
          customerPhone: session.customer_details?.phone ?? null,
          shippingAddress: addr ? {
            line1: addr.line1,
            line2: addr.line2 ?? null,
            city: addr.city,
            state: addr.state ?? null,
            postalCode: addr.postal_code,
            country: addr.country,
          } : null,
          shippingCost,
          shippingMethod,
        },
        { new: true }
      );

      if (updatedOrder) {
        await Promise.allSettled([
          sendOrderConfirmation(updatedOrder),
          sendAdminOrderNotification(updatedOrder),
        ]);
      }
    } catch (err) {
      console.error('Failed to update order:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;
