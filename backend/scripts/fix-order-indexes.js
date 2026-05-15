require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Old broken indexes to drop (created by unique:true + default:null on schema fields).
// Mongoose will recreate the correct partial unique indexes on next startup.
const INDEX_NAMES = [
  'stripeSessionId_1',
  'stripePaymentIntentId_1',
  'orderNumber_1',
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const col = mongoose.connection.db.collection('orders');

  for (const name of INDEX_NAMES) {
    try {
      await col.dropIndex(name);
      console.log(`[dropped] ${name}`);
    } catch (err) {
      if (err.codeName === 'IndexNotFound') {
        console.log(`[skip]    ${name} — not found (already dropped or never created)`);
      } else {
        console.error(`[error]   ${name} — ${err.message}`);
      }
    }
  }

  // Remove orphan pre-payment Order documents with both Stripe IDs null and status pending.
  // These were created during development / the period when the broken index existed.
  const result = await col.deleteMany({
    stripeSessionId: null,
    stripePaymentIntentId: null,
    status: { $in: ['pending', 'failed'] },
  });
  console.log(`[cleaned] ${result.deletedCount} orphan pre-payment orders deleted`);

  await mongoose.disconnect();
  console.log('Done. Restart the backend — Mongoose will recreate correct indexes from schema.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
