'use strict';

const AuditLog = require('../models/AuditLog');

// Append an audit record for a sensitive admin action. Fire-and-forget and
// fail-soft: an audit write must NEVER break or block the operation it records,
// so all errors are swallowed and logged. Pass only small, non-sensitive detail
// in `meta` (amounts, statuses, ids — never card data, tokens, or full PII).
async function recordAudit(req, action, { targetType, targetId, meta } = {}) {
  try {
    await AuditLog.create({
      actorId:    req && req.user && req.user.userId != null ? String(req.user.userId) : undefined,
      actorEmail: req && req.user && req.user.email ? req.user.email : undefined,
      action,
      targetType,
      targetId: targetId != null ? String(targetId) : undefined,
      meta,
      ip: req && req.ip,
    });
  } catch (err) {
    console.error('[audit] failed to record', action, err.message);
  }
}

module.exports = { recordAudit };
