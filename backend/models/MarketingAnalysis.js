const mongoose = require('mongoose');

// One document per day — keyed by dateStr (YYYY-MM-DD)
const marketingAnalysisSchema = new mongoose.Schema({
  dateStr:        { type: String, required: true, unique: true }, // '2026-05-17'
  bullets:        [String],  // internal / Гріша bullets
  founderBullets: [String],  // plain-language Sabreen bullets
  generatedAt:    { type: Date, default: Date.now },
  dataSnapshot: {
    activeCampaigns: Number,
    totalSpend7d:    Number,
    totalOrders7d:   Number,
    totalRevenue7d:  Number,
  },
}, { timestamps: false });

module.exports = mongoose.model('MarketingAnalysis', marketingAnalysisSchema);
