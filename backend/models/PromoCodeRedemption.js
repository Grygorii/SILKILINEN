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

// DB-enforced idempotency: a given order can redeem a given code at most once,
// so a retried/replayed webhook can never create a second redemption row (and
// thus never double-increment usageCount) even under a race. Complements the
// findOne guard in redeemDiscount. NOT a {promoCodeId, customerEmail} unique
// index — that would wrongly reject legitimate repeat use of multi-use codes.
promoCodeRedemptionSchema.index({ promoCodeId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('PromoCodeRedemption', promoCodeRedemptionSchema);
