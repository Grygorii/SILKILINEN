const mongoose = require('mongoose');

// A coordinated marketing plan produced by the Marketing Coordinator — the
// "lead" that turns a goal + the specialist agents' intel into ONE deliverable.
// Unlike the flat GrowthAction feed (what each agent did) or the CEOBrief (the
// weekly state of the business), this is a goal-scoped campaign: an objective,
// the key insight, and channel "plays" each OWNED by a named specialist and
// broken into concrete, trackable tasks that link to where the work happens.

const taskSchema = new mongoose.Schema({
  text:  { type: String, required: true },
  href:  { type: String, default: '' },   // where to do it (admin link)
  agent: { type: String, default: '' },    // which specialist owns it
  done:  { type: Boolean, default: false },
}, { _id: true });

const playSchema = new mongoose.Schema({
  channel:   { type: String, default: '' }, // SEO | Content | Social | Email | On-site | Product
  agent:     { type: String, default: '' }, // owning specialist (registry name)
  title:     { type: String, default: '' },
  rationale: { type: String, default: '' },
  tasks:     { type: [taskSchema], default: [] },
}, { _id: true });

const marketingPlanSchema = new mongoose.Schema({
  mode:          { type: String, enum: ['interactive', 'weekly'], default: 'interactive' },
  goal:          { type: String, default: '' },   // the founder's brief, or the derived weekly objective
  focus:         { type: String, default: '' },   // optional product / category / channel scope
  objective:     { type: String, default: '' },   // the Coordinator's refined objective
  insight:       { type: String, default: '' },   // the single key insight the plan turns on
  audience:      { type: String, default: '' },
  engagedAgents: { type: [String], default: [] }, // which specialists were orchestrated (visible)
  plays:         { type: [playSchema], default: [] },
  timeline:      { type: String, default: '' },
  successMetric: { type: String, default: '' },
  verdict:       { type: String, default: '' },   // the verification (clerk) line
  status:        { type: String, enum: ['active', 'done', 'archived'], default: 'active', index: true },
  usedFallback:  { type: Boolean, default: false },
  triggeredBy:   { type: String, default: '' },
}, { timestamps: true });

marketingPlanSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketingPlan', marketingPlanSchema);
