const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const SiteAudit = require('../models/SiteAudit');
const { runAudit } = require('../services/auditAgents');

router.post('/', requireAuth, async function(req, res) {
  try {
    const audit = await SiteAudit.create({ triggeredBy: req.user?.email || 'admin' });
    // Fire-and-forget — don't await
    runAudit(audit).catch(err => console.error('Audit failed:', err));
    res.status(202).json({ auditId: audit._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async function(req, res) {
  try {
    const audits = await SiteAudit.find({})
      .sort({ runAt: -1 })
      .limit(10)
      .select('runAt completedAt duration status agents triggeredBy');
    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async function(req, res) {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ error: 'Audit not found' });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/findings/:idx', requireAuth, async function(req, res) {
  try {
    const { status } = req.body;
    if (!['open', 'fixed', 'wont_fix'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ error: 'Audit not found' });
    const idx = parseInt(req.params.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= audit.findings.length) {
      return res.status(400).json({ error: 'Invalid finding index' });
    }
    audit.findings[idx].status = status;
    await audit.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
