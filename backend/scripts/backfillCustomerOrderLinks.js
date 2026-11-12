/** Reconcile guest profiles using the same service as the application; no emails or payments.
 * Default is read-only: node backend/scripts/backfillCustomerOrderLinks.js
 * Apply bounded batches: node backend/scripts/backfillCustomerOrderLinks.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { reconcileCustomerOrders } = require('../services/customerOrders');
async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const dryRun = !process.argv.includes('--apply');
    let report;
    do {
      report = await reconcileCustomerOrders({ dryRun, limit: 100 });
      console.log(JSON.stringify(report)); // Aggregate counts only; no customer addresses.
    } while (!dryRun && report.remaining > 0 && report.failed === 0 && report.scanned > 0);
    if (report.failed) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) run().catch(err => { console.error(err.message); process.exitCode = 1; });
module.exports = { run };
