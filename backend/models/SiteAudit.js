const mongoose = require('mongoose');

const FindingSchema = new mongoose.Schema({
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  agent: { type: String, enum: ['navigation', 'journeys', 'consistency'], required: true },
  title: { type: String, required: true },
  detail: String,
  location: String,
  suggestion: String,
  status: { type: String, enum: ['open', 'fixed', 'wont_fix'], default: 'open' },
}, { _id: false });

const AgentResultSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'running', 'done', 'error'], default: 'pending' },
  duration: Number,
  findingsCount: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  infoCount: { type: Number, default: 0 },
  error: String,
}, { _id: false });

const SiteAuditSchema = new mongoose.Schema({
  runAt: { type: Date, default: Date.now },
  completedAt: Date,
  duration: Number,
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  agents: {
    navigation: { type: AgentResultSchema, default: () => ({}) },
    journeys: { type: AgentResultSchema, default: () => ({}) },
    consistency: { type: AgentResultSchema, default: () => ({}) },
  },
  findings: [FindingSchema],
  triggeredBy: String,
}, { timestamps: false });

module.exports = mongoose.model('SiteAudit', SiteAuditSchema);
