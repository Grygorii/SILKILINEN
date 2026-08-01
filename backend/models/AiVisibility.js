'use strict';

const mongoose = require('mongoose');

// One AI-search visibility run: a set of buyer-intent questions asked of the
// AI assistants shoppers actually use, recording whether SILKILINEN was named,
// whether the site was cited as a source, and which competitors were
// recommended instead. Kept over time so the trend is visible.
const resultSchema = new mongoose.Schema({
  prompt: String,
  provider: { type: String, enum: ['gemini', 'deepseek', 'openai'] },
  mentioned: { type: Boolean, default: false },   // brand named in the answer
  cited: { type: Boolean, default: false },       // silkilinen.com used as a source
  competitors: [String],                          // rival brands named instead
  sources: [{ title: String, uri: String, _id: false }],
  excerpt: String,                                // short slice of the answer, for context
  error: String,
}, { _id: false });

const aiVisibilitySchema = new mongoose.Schema({
  runAt: { type: Date, default: Date.now },
  completedAt: Date,
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  triggeredBy: String,
  // Headline numbers (percentages are 0–100).
  visibility: { type: Number, default: 0 },   // % of answers naming the brand
  mentions: { type: Number, default: 0 },
  citations: { type: Number, default: 0 },
  queries: { type: Number, default: 0 },
  byProvider: { type: mongoose.Schema.Types.Mixed, default: {} }, // provider -> {queries,mentions,citations}
  competitorShare: [{ name: String, count: Number, _id: false }],
  results: [resultSchema],
  note: String,
}, { timestamps: true });

aiVisibilitySchema.index({ runAt: -1 });

module.exports = mongoose.model('AiVisibility', aiVisibilitySchema);
