const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { sendCartRecoveryEmail } = require('./email');

const PAID = ['paid', 'processing', 'shipped', 'delivered'];

// Send email N once the cart has been inactive for minHours, stop at maxHours so
// the next run doesn't double-send. Anchored on the cart's updatedAt (genuine
// activity) — the dedup push below is written with timestamps:false so logging a
// sent email doesn't reset the clock.
const WINDOWS = [
  { seq: 1, minHours:  4, maxHours:  5 },
  { seq: 2, minHours: 24, maxHours: 25 },
  { seq: 3, minHours: 72, maxHours: 73 },
];

async function processCartRecovery() {
  if (!process.env.RESEND_API_KEY) return; // email not configured — skip silently

  const now = new Date();
  let sent = 0;

  for (const win of WINDOWS) {
    const windowStart = new Date(now - win.maxHours * 3600_000); // older edge (earlier in time)
    const windowEnd   = new Date(now - win.minHours * 3600_000); // newer edge

    // Abandoned carts: they still have items + a captured email, the shopper
    // hasn't touched them within the window, they haven't unsubscribed, and this
    // sequence hasn't been sent. A completed purchase deletes the cart, so any
    // surviving cart is genuinely unconverted.
    const candidates = await Cart.find({
      'items.0': { $exists: true },
      email: { $exists: true, $ne: null, $ne: '' },
      recoveryUnsubscribed: { $ne: true },
      updatedAt: { $gte: windowStart, $lte: windowEnd },
      'recoveryEmails.seq': { $ne: win.seq },
    }).limit(50).lean();

    for (const cart of candidates) {
      try {
        // Belt-and-suspenders: never email someone who actually bought (in the
        // rare case the post-purchase cart delete didn't land).
        const bought = await Order.exists({ browserSessionId: cart.sessionId, status: { $in: PAID } });
        if (bought) continue;

        await sendCartRecoveryEmail(cart, win.seq);
        // timestamps:false so recording the send doesn't bump updatedAt and
        // skew the next window.
        await Cart.updateOne(
          { _id: cart._id },
          { $push: { recoveryEmails: { seq: win.seq, sentAt: now } } },
          { timestamps: false },
        );
        sent++;
        console.log(`[cart-recovery] seq ${win.seq} sent → ${cart.email}`);
      } catch (err) {
        console.error(`[cart-recovery] seq ${win.seq} failed for ${cart._id}:`, err.message);
      }
    }
  }

  if (sent > 0) console.log(`[cart-recovery] Run complete — ${sent} email(s) sent`);
}

module.exports = { processCartRecovery };
