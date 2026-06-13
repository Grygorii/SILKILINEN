const mongoose = require('mongoose');

// A Da Vinci composition — the masterwork the conductor produces when
// unleashed: every agent's output woven into one bold, coherent vision.
// Not a weekly memo (that's the Co-CEO brief) — a 90-day symphony.
const daVinciSchema = new mongoose.Schema({
  vision:    { type: String, required: true },   // the unifying 90-day vision
  grandIdea: { type: mongoose.Schema.Types.Mixed }, // { title, what, why } — the one audacious move
  movements: { type: [{                             // themed campaign movements
    title: String,
    theme: String,
    moves: [String],
    _id: false,
  }], default: [] },
  closing:   { type: String, default: '' },
  conducted: { type: mongoose.Schema.Types.Mixed }, // what was on the desk when composed (provenance)
}, { timestamps: true });

daVinciSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DaVinciComposition', daVinciSchema);
