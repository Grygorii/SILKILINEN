const mongoose = require('mongoose');

// ARCHIVARIUS — the house's living memory. Not a flat "what works" list, but a
// structured, weighted store the whole team feeds and reads. Four kinds:
//   • lesson   — what works (proven by real outcomes)
//   • pitfall  — what we got WRONG before (from the clerks/watchdog) — avoid it
//   • fact     — a verified truth about the business (don't contradict)
//   • decision — a founder/strategic choice to honour
//
// It LEARNS: re-teaching the same thing reinforces it (weight + hits grow), so
// the recurring, important memory rises to the top; the weakest is pruned. This
// is the loop that lets agents avoid repeating mistakes.

const memoryEntrySchema = new mongoose.Schema({
  //   • reference — a founder-curated source (link/book) distilled into
  //     principles the agents should apply (the "library").
  kind:     { type: String, enum: ['lesson', 'pitfall', 'fact', 'decision', 'reference'], default: 'lesson', index: true },
  text:     { type: String, required: true },
  textKey:  { type: String, required: true },   // normalised, for dedupe/reinforce
  detail:   { type: String, default: '' },
  source:   { type: String, default: '' },      // who taught it (chief, hermes, reasoningClerk, watchdog, founder…)
  // ── Library (kind: 'reference') ──────────────────────────────────────
  title:    { type: String, default: '' },      // source name, e.g. "Google SEO Starter Guide"
  refType:  { type: String, default: '' },      // 'link' | 'book'
  refSource:{ type: String, default: '' },      // the URL (link) or author (book)
  tags:     { type: [String], default: [] },    // topics (seo, content, social, pricing, imagery…)
  weight:   { type: Number, default: 1 },       // importance/confidence — grows as it's reinforced
  hits:     { type: Number, default: 1 },       // times re-taught
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

memoryEntrySchema.index({ kind: 1, textKey: 1 }, { unique: true });
memoryEntrySchema.index({ weight: -1, lastSeen: -1 });
memoryEntrySchema.index({ tags: 1 });

module.exports = mongoose.model('MemoryEntry', memoryEntrySchema);
