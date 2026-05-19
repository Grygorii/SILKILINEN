const Order = require('../models/Order');
const { sendCartRecoveryEmail } = require('./email');

// Send email N at +minHours, stop at +maxHours so next run doesn't double-send.
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

    const candidates = await Order.find({
      status: 'pending',
      recoveryUnsubscribed: { $ne: true },
      customerEmail: { $exists: true, $ne: null, $ne: '' },
      createdAt: { $gte: windowStart, $lte: windowEnd },
      'recoveryEmails.seq': { $ne: win.seq },
    }).limit(50).lean();

    for (const orderDoc of candidates) {
      try {
        await sendCartRecoveryEmail(orderDoc, win.seq);
        await Order.updateOne(
          { _id: orderDoc._id },
          { $push: { recoveryEmails: { seq: win.seq, sentAt: now } } }
        );
        sent++;
        console.log(`[cart-recovery] seq ${win.seq} sent → ${orderDoc.customerEmail}`);
      } catch (err) {
        console.error(`[cart-recovery] seq ${win.seq} failed for ${orderDoc._id}:`, err.message);
      }
    }
  }

  if (sent > 0) console.log(`[cart-recovery] Run complete — ${sent} email(s) sent`);
}

module.exports = { processCartRecovery };
