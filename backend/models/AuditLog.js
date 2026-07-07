const mongoose = require('mongoose');

// Append-only audit trail for sensitive admin actions (refunds, order status
// changes, manual orders, and future high-value writes). Kept in its OWN
// collection rather than as fields on the mutated document, so the record of
// "who did what, when" survives even if the target document is later edited or
// deleted. The application only ever CREATEs here — never updates or deletes —
// which is what makes it trustworthy after an incident.
const auditLogSchema = new mongoose.Schema({
  actorId:    { type: String },                       // admin userId from the JWT
  actorEmail: { type: String },                       // when known
  action:     { type: String, required: true, index: true }, // e.g. 'order.refund'
  targetType: { type: String },                       // 'Order', 'Product', ...
  targetId:   { type: String },
  meta:       { type: mongoose.Schema.Types.Mixed },  // small, non-sensitive detail
  ip:         { type: String },
  at:         { type: Date, default: Date.now, index: true },
}, { timestamps: false });

module.exports = mongoose.model('AuditLog', auditLogSchema);
