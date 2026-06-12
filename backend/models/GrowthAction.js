const mongoose = require('mongoose');

// One entry per thing the Growth Engine did (or wants approval for) — the
// "pulse log" the founder watches in Admin → Growth Engine.
const growthActionSchema = new mongoose.Schema({
  agent:  { type: String, required: true },  // content | social | newsletter | watchdog
  type:   { type: String, required: true },  // article_draft | social_draft | alert | info ...
  title:  { type: String, required: true },
  detail: { type: String, default: '' },
  href:   { type: String, default: '' },     // admin link to review the output
  status: { type: String, enum: ['done', 'needs_approval', 'info', 'error'], default: 'info' },
  meta:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

growthActionSchema.index({ createdAt: -1 });
growthActionSchema.index({ agent: 1, createdAt: -1 });

module.exports = mongoose.model('GrowthAction', growthActionSchema);
