const Customer = require('../models/Customer');
const Segment = require('../models/Segment');

const SEGMENT_DEFS = [
  { slug: 'vip',             label: 'VIP',            description: 'Top 10% by lifetime spend',   color: '#5c35a8' },
  { slug: 'repeat',          label: 'Repeat',          description: '2+ orders placed',            color: '#2d7d47' },
  { slug: 'first-time',      label: 'First-time',      description: 'Exactly 1 order',             color: '#1565c0' },
  { slug: 'newsletter-only', label: 'Newsletter only', description: 'Subscribed, 0 orders',        color: '#b07d00' },
  { slug: 'recent',          label: 'Recent',          description: 'Ordered in last 30 days',     color: '#00838f' },
  { slug: 'lapsed',          label: 'Lapsed',          description: 'Last order 60–180 days ago',  color: '#e65100' },
  { slug: 'at-risk',         label: 'At risk',         description: 'No order in 90+ days',        color: '#c62828' },
];

async function computeSegmentsForCustomer(customer) {
  const segments = [];
  const now = Date.now();
  const count = customer.orderCount || 0;
  const spend = customer.totalSpend || 0;
  const lastMs = customer.lastOrderAt ? new Date(customer.lastOrderAt).getTime() : null;

  if (count >= 2) segments.push('repeat');
  if (count === 1) segments.push('first-time');
  if (count === 0 && customer.marketingConsent) segments.push('newsletter-only');

  if (lastMs) {
    const daysSince = (now - lastMs) / 86400000;
    if (daysSince <= 30) segments.push('recent');
    if (daysSince >= 60 && daysSince <= 180) segments.push('lapsed');
    if (daysSince >= 90) segments.push('at-risk');
  }

  // VIP: computed separately (needs global spend percentile), so skip here.
  // applyVipSegment() below handles it.
  return segments;
}

// Recompute segments for a single customer doc (in-place, does not save).
async function assignSegments(customer) {
  customer.segments = await computeSegmentsForCustomer(customer);
}

// Full recompute across all customers — called from the admin "Recompute" button.
async function recomputeAll() {
  const customers = await Customer.find({}).lean();

  // Determine VIP threshold: top 10% by totalSpend among customers with at least 1 order
  const withOrders = customers.filter(c => (c.orderCount || 0) > 0).sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
  const vipCount = Math.max(1, Math.ceil(withOrders.length * 0.1));
  const vipIds = new Set(withOrders.slice(0, vipCount).map(c => String(c._id)));

  const now = Date.now();
  const bulkOps = [];

  for (const c of customers) {
    const segments = [];
    const count = c.orderCount || 0;
    const lastMs = c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : null;

    if (vipIds.has(String(c._id))) segments.push('vip');
    if (count >= 2) segments.push('repeat');
    if (count === 1) segments.push('first-time');
    if (count === 0 && c.marketingConsent) segments.push('newsletter-only');

    if (lastMs) {
      const daysSince = (now - lastMs) / 86400000;
      if (daysSince <= 30) segments.push('recent');
      if (daysSince >= 60 && daysSince <= 180) segments.push('lapsed');
      if (daysSince >= 90) segments.push('at-risk');
    }

    bulkOps.push({ updateOne: { filter: { _id: c._id }, update: { $set: { segments } } } });
  }

  if (bulkOps.length) await Customer.bulkWrite(bulkOps);

  // Update Segment collection counts
  const upserts = SEGMENT_DEFS.map(async def => {
    const count = customers.filter(c => {
      // Re-check from bulkOps isn't straightforward here; compute from fresh data is fine since
      // recomputeAll is a background operation. Use the segments we just computed.
      const op = bulkOps.find(o => o.updateOne.update.$set.segments !== undefined);
      return false; // placeholder — see below
    }).length;

    // Simpler: just query after bulkWrite
    const cnt = await Customer.countDocuments({ segments: def.slug });
    return Segment.findOneAndUpdate(
      { slug: def.slug },
      { $set: { slug: def.slug, label: def.label, description: def.description, color: def.color, count: cnt, lastComputedAt: new Date() } },
      { upsert: true, new: true },
    );
  });
  await Promise.all(upserts);

  return { updated: bulkOps.length };
}

// Seed the Segment documents if they don't exist yet (idempotent).
async function ensureSegmentDocs() {
  for (const def of SEGMENT_DEFS) {
    await Segment.findOneAndUpdate(
      { slug: def.slug },
      { $setOnInsert: { ...def, count: 0 } },
      { upsert: true },
    );
  }
}

module.exports = { assignSegments, recomputeAll, ensureSegmentDocs, SEGMENT_DEFS };
