'use strict';

// Tells waiting customers when a sold-out piece is back.
//
// Runs on the same hourly tick as cart recovery rather than hooking the product
// save path: stock changes through several routes (admin edit, CSV import, an
// order decrementing it), and a sweep that asks "is it in stock now?" cannot be
// bypassed by whichever one we forgot to instrument.

const Product = require('../models/Product');
const StockNotification = require('../models/StockNotification');
const { sendBackInStock } = require('./email');

async function processStockNotifications() {
  if (!process.env.RESEND_API_KEY) return 0; // email not configured — skip silently

  // Only products someone is actually waiting for.
  const productIds = await StockNotification.distinct('product', { notifiedAt: null });
  if (!productIds.length) return 0;

  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
    totalStock: { $gt: 0 },
  }).select('_id name slug price images image totalStock').lean();

  let sent = 0;
  for (const product of products) {
    const waiting = await StockNotification.find({ product: product._id, notifiedAt: null })
      .limit(200)
      .lean();

    for (const req of waiting) {
      try {
        // Claim the row BEFORE sending. If the send throws we have still marked
        // it, which loses one email; the alternative — marking after — risks
        // emailing the same person on every hourly run if the mail provider is
        // flaking. For a restock notice, one missed beats a repeating one.
        const claimed = await StockNotification.findOneAndUpdate(
          { _id: req._id, notifiedAt: null },
          { $set: { notifiedAt: new Date() } },
        );
        if (!claimed) continue; // another run took it

        await sendBackInStock({ email: req.email, product, size: req.size, colour: req.colour });
        sent++;
      } catch (err) {
        console.error('[stockNotify] send failed for', req.email, err.message);
      }
    }
  }
  return sent;
}

module.exports = { processStockNotifications };
