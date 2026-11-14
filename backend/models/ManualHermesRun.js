'use strict';

// A separate record for a reviewed, external-AI Hermes hand-off. It holds the
// exact live snapshot sent out and the returned recommendations, but never a
// catalogue mutation. Publishing can only add reviewed GrowthAction records.
const mongoose = require('mongoose');

const playSchema = new mongoose.Schema({
  key: { type: String, required: true },
  target: { type: String, required: true },
  intent: { type: String, enum: ['informational', 'commercial', 'transactional'], required: true },
  kind: { type: String, enum: ['meta', 'content'], required: true },
  entityType: { type: String, enum: ['product', 'category', 'collection', 'page'], required: true },
  entityRef: { type: String, required: true },
  entityId: { type: String, default: '' },
  position: { type: Number, required: true },
  impressions: { type: Number, required: true },
  issue: { type: String, required: true },
  action: { type: String, required: true },
  leverage: { type: String, enum: ['high', 'low'], required: true },
  warnings: { type: [String], default: [] },
  publishedAt: { type: Date, default: null },
  publishedActionId: { type: String, default: '' },
}, { _id: false });

const manualHermesRunSchema = new mongoose.Schema({
  contract: { type: String, default: 'silkilinen.external-ai.hermes.v1' },
  schemaVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['prepared', 'imported', 'partially_published', 'published'], default: 'prepared', index: true },
  // A SHA-256 fingerprint of the prepared evidence. The response must repeat it
  // exactly, which prevents a reply for another live snapshot being imported.
  snapshotId: { type: String, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  read: { type: String, default: '' },
  plays: { type: [playSchema], default: [] },
  provider: { type: String, default: '' },
  importedResponse: { type: String, default: '', maxlength: 100000 },
  createdBy: { type: String, default: '' },
  importedAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

manualHermesRunSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ManualHermesRun', manualHermesRunSchema);
