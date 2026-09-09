const mongoose = require('mongoose');

// Crawler traffic, kept OUT of the Visit collection on purpose.
//
// The obvious design is a `Visit.isBot` flag, and it is a trap here: Visit is
// queried from 29 places across 14 files — the funnel, advisor, analyst, chief
// of staff, dashboard, insights, campaigns, marketing, Pin Studio and even
// checkoutV2. Every one of them would have to remember the filter, and the one
// that forgot would silently inflate the funnel with Googlebot. That is worse
// than the old behaviour of discarding bots outright, because the numbers would
// stop being honestly human without anything saying so.
//
// A separate collection cannot be got wrong: those 29 aggregations never see
// this data, so they stay correct by construction rather than by vigilance.
//
// Deliberately thin — a crawler has no session, no journey and no basket. Just
// what it is, what it asked for, and when.
const botHitSchema = new mongoose.Schema({
  // The display name from frontend/lib/isBot.ts `botName()`, which is the ONE
  // rule for both "is this a bot" and "what is it called", so the two answers
  // cannot disagree.
  bot:       { type: String, required: true },
  page:      { type: String },
  // Truncated at the route. Kept so an unrecognised crawler can be named later
  // without waiting for it to come back.
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Every read groups by bot within a date window.
botHitSchema.index({ createdAt: 1, bot: 1 });

// 90 days, matching Visit and Event. ONE declaration for this key — a plain
// `index: true` on the path as well would collide with the TTL and MongoDB
// would refuse whichever it built second. See the index invariant in
// PROJECT_MAP; it cost this codebase the retention policy on both other
// collections for months.
botHitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('BotHit', botHitSchema);
