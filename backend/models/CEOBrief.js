const mongoose = require('mongoose');

// One weekly Co-CEO briefing — the output of the Chief of Staff cycle:
// measure (vs the North Star) → attribute (what changed & why) → learn
// (what's working) → decide (the highest-leverage moves) → delegate.
// Kept as history so progress is auditable week over week.
const ceoBriefSchema = new mongoose.Schema({
  headline:   { type: String, required: true },   // one-line state of the business
  northStar:  { type: mongoose.Schema.Types.Mixed }, // { metric, target, current, deadline, pct }
  progress:   { type: String, default: '' },      // where we are vs the goal, in words
  whatChanged:{ type: String, default: '' },      // deltas this week + likely cause
  whatsWorking:{ type: String, default: '' },     // learned signal from outcomes
  moves:      { type: [{ title: String, agent: String, why: String, _id: false }], default: [] },
  founderActions: { type: [String], default: [] },// the few things only the founder can do
  buildIdeas: { type: [{ title: String, source: String, why: String, _id: false }], default: [] },
  metrics:    { type: mongoose.Schema.Types.Mixed }, // raw numbers the brief was built from
}, { timestamps: true });

ceoBriefSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CEOBrief', ceoBriefSchema);
