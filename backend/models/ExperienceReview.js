const mongoose = require('mongoose');

// An Entrance Review from The Atelier — the storefront-experience counterpart to
// the marketing Garden. A luxury creative director (powered by Gemini Vision)
// LOOKS at the real entrance imagery (homepage hero + product photography) and
// judges whether opening the site feels like stepping into a villa or a discount
// rail — then lists the dissonances and the precise fixes, ranked.

const dissonanceSchema = new mongoose.Schema({
  what:     { type: String, default: '' },  // the thing that cheapens it
  why:      { type: String, default: '' },  // why it breaks the luxury feel
  fix:      { type: String, default: '' },  // the precise correction
  severity: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
}, { _id: false });

const fixSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  where: { type: String, default: '' },  // which surface
  how:   { type: String, default: '' },
  agent: { type: String, default: '' },  // which specialist could do it (e.g. Maui, Photographer)
}, { _id: false });

// One "room" of the villa — a page, judged on its own.
const roomSchema = new mongoose.Schema({
  name:           { type: String, default: '' },
  path:           { type: String, default: '' },
  score:          { type: Number, default: 0 },   // 1-10 for THIS room
  verdict:        { type: String, default: '' },
  dissonances:    { type: [dissonanceSchema], default: [] },
  usedScreenshot: { type: Boolean, default: false }, // saw the rendered page vs content-only
  loadMs:         { type: Number, default: 0 },
}, { _id: false });

const experienceReviewSchema = new mongoose.Schema({
  scope:           { type: String, enum: ['entrance', 'house'], default: 'house' },
  wowScore:        { type: Number, default: 0 },   // 1-10: the whole house, worst-room-weighted
  weakestRoom:     { type: String, default: '' },  // the room that lets the villa down
  verdict:         { type: String, default: '' },  // one-line honest verdict
  firstImpression: { type: String, default: '' },  // what the first 5 seconds feel like
  strengths:       { type: [String], default: [] },
  dissonances:     { type: [dissonanceSchema], default: [] }, // the worst across the whole house
  fixes:           { type: [fixSchema], default: [] },  // the prioritised cross-house plan
  benchmark:       { type: String, default: '' },  // how it reads vs the top luxury houses
  rooms:           { type: [roomSchema], default: [] }, // every page, scored
  imagesReviewed:  { type: [String], default: [] },
  usedVision:      { type: Boolean, default: false },
  usedFallback:    { type: Boolean, default: false },
  triggeredBy:     { type: String, default: '' },
}, { timestamps: true });

experienceReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ExperienceReview', experienceReviewSchema);
