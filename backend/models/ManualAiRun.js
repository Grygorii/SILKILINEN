'use strict';

// A persisted, review-first hand-off to an external AI. Unlike an AI-agent log,
// this records the exact catalogue snapshot that left the shop and the exact
// proposals that came back, so an old prompt can never silently overwrite newer
// work when it is eventually pasted back in.
const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  key: { type: String, required: true },
  type: { type: String, enum: ['product', 'category', 'collection'], required: true },
  resourceId: { type: String, required: true },
  label: { type: String, required: true },
  url: { type: String, required: true },
  snapshot: {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  proposal: {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    warnings: { type: [String], default: [] },
    appliedAt: { type: Date, default: null },
    stale: { type: Boolean, default: false },
  },
}, { _id: false });

const manualAiRunSchema = new mongoose.Schema({
  taskType: { type: String, enum: ['seo_meta_v1'], required: true, index: true },
  schemaVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['prepared', 'imported', 'partially_applied', 'applied'], default: 'prepared', index: true },
  targets: { type: [targetSchema], default: [] },
  provider: { type: String, default: '' },
  // Kept solely for an accountable review trail. It is never rendered as HTML.
  importedResponse: { type: String, default: '', maxlength: 100000 },
  createdBy: { type: String, default: '' },
  importedAt: { type: Date, default: null },
  lastAppliedAt: { type: Date, default: null },
}, { timestamps: true });

manualAiRunSchema.index({ taskType: 1, createdAt: -1 });

module.exports = mongoose.model('ManualAiRun', manualAiRunSchema);
