const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  fileUrl:    { type: String, required: true },
  fileName:   { type: String },
  fileSize:   { type: Number },
  mimeType:   { type: String },
  uploadedBy: { type: String },

  expenseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense', index: true }],
  orderIds:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order',   index: true }],

  description:    { type: String, trim: true },
  totalOnReceipt: { type: Number },
  vendor:         { type: String, trim: true },

  cloudinaryPublicId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);
