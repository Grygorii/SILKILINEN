const mongoose = require('mongoose');

const promoCodeRedemptionSchema = new mongoose.Schema({
  promoCodeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
  code:           { type: String, required: true },
  orderId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber:    { type: String },
  customerEmail:  { type: String },
  discountAmount: { type: Number, default: 0 },
  redeemedAt:     { type: Date, default: Date.now },
}, { timestamps: false });

promoCodeRedemptionSchema.index({ promoCodeId: 1, customerEmail: 1 });

module.exports = mongoose.model('PromoCodeRedemption', promoCodeRedemptionSchema);
