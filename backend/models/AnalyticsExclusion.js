const mongoose = require('mongoose');

// An opaque browser ID is retained only long enough to prevent an in-flight
// tracking beacon from recreating activity the owner has just removed.
const analyticsExclusionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, trim: true, maxlength: 128 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

module.exports = mongoose.model('AnalyticsExclusion', analyticsExclusionSchema);
