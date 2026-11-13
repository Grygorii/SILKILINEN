'use strict';

// Admin-only external-AI hand-off. It never calls a model or mutates catalogue
// data on import: a founder explicitly reviews and applies each validated SEO
// proposal after the live source has been checked again.
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ManualAiRun = require('../models/ManualAiRun');
const { readSeoTarget, saveSeoMeta } = require('../services/seoMetadata');
const { recordAudit } = require('../services/auditLog');
const { findOriginClaims } = require('../utils/originClaims');
const {
  SEO_TASK, MAX_TARGETS, TASK_CAPABILITIES, targetKey,
  buildSeoPrompt, validateSeoImport, snapshotMatches,
} = require('../services/manualAiWorkspace');

router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function serialise(run) {
  const doc = typeof run.toObject === 'function' ? run.toObject() : run;
  return {
    id: String(doc._id), taskType: doc.taskType, schemaVersion: doc.schemaVersion,
    status: doc.status, provider: doc.provider || '', createdAt: doc.createdAt,
    importedAt: doc.importedAt, lastAppliedAt: doc.lastAppliedAt,
    targets: (doc.targets || []).map(target => ({
      key: target.key, type: target.type, resourceId: target.resourceId, label: target.label, url: target.url,
      snapshot: { metaTitle: target.snapshot?.metaTitle || '', metaDescription: target.snapshot?.metaDescription || '' },
      proposal: target.proposal?.metaTitle || target.proposal?.metaDescription
        ? { metaTitle: target.proposal.metaTitle, metaDescription: target.proposal.metaDescription, warnings: target.proposal.warnings || [], appliedAt: target.proposal.appliedAt, stale: Boolean(target.proposal.stale) }
        : null,
    })),
  };
}

function compactContext(context) {
  const input = context || {};
  return {
    ...input,
    description: String(input.description || '').slice(0, 1800),
    items: Array.isArray(input.items) ? input.items.slice(0, 12).map(value => String(value).slice(0, 140)) : [],
    keywords: Array.isArray(input.keywords) ? input.keywords.slice(0, 10).map(value => String(value).slice(0, 80)) : [],
  };
}

async function getRun(id) {
  try { return await ManualAiRun.findById(id); }
  catch { return null; }
}

// GET /tasks — the task registry plus a short history, so an unfinished hand-off
// can be resumed after closing the browser.
router.get('/tasks', async (req, res) => {
  try {
    const runs = await ManualAiRun.find({ taskType: SEO_TASK }).sort({ createdAt: -1 }).limit(12).lean();
    res.json({ capabilities: TASK_CAPABILITIES, runs: runs.map(serialise) });
  } catch (err) {
    console.error('[manual-ai] list:', err.message);
    res.status(500).json({ error: 'Could not load Manual AI tasks.' });
  }
});

// POST /tasks/seo-meta/prepare — the server resolves IDs against its own live
// catalogue, then saves the snapshot before returning a copyable prompt.
router.post('/tasks/seo-meta/prepare', async (req, res) => {
  const input = Array.isArray(req.body?.targets) ? req.body.targets : [];
  if (!input.length) return res.status(400).json({ error: 'Choose at least one catalogue page.' });
  if (input.length > MAX_TARGETS) return res.status(400).json({ error: `Choose no more than ${MAX_TARGETS} pages at a time.` });
  const seen = new Set();
  for (const item of input) {
    if (!item || !['product', 'category', 'collection'].includes(item.type) || typeof item.id !== 'string') {
      return res.status(400).json({ error: 'Each selected page must be a product, category or collection.' });
    }
    const key = targetKey(item.type, item.id);
    if (seen.has(key)) return res.status(400).json({ error: 'A page was selected more than once.' });
    seen.add(key);
  }

  try {
    const resolved = await Promise.all(input.map(item => readSeoTarget(item.type, item.id, { context: true })));
    if (resolved.some(item => !item)) return res.status(400).json({ error: 'One selected page is no longer a live catalogue page. Refresh and try again.' });
    const run = await ManualAiRun.create({
      taskType: SEO_TASK,
      createdBy: req.user?.email || String(req.user?.userId || 'admin'),
      targets: resolved.map(item => ({
        key: targetKey(item.type, item.id), type: item.type, resourceId: item.id, label: item.label, url: item.url,
        snapshot: { metaTitle: item.metaTitle, metaDescription: item.metaDescription, updatedAt: item.updatedAt, context: compactContext(item.context) },
      })),
    });
    await recordAudit(req, 'manual_ai.prepared', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType: SEO_TASK, count: run.targets.length } });
    res.status(201).json({ task: serialise(run), prompt: buildSeoPrompt(run), itemCount: run.targets.length });
  } catch (err) {
    console.error('[manual-ai] prepare:', err.message);
    res.status(500).json({ error: 'Could not prepare the SEO prompt.' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Manual AI task not found.' });
  res.json({ task: serialise(run), prompt: buildSeoPrompt(run) });
});

// POST /tasks/:id/import — parse and validate a pasted response. This endpoint
// deliberately contains no save call for Product/Category/Collection.
router.post('/tasks/:id/import', async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Manual AI task not found.' });
  if (run.taskType !== SEO_TASK) return res.status(400).json({ error: 'Unsupported task type.' });
  if (run.status === 'applied' || run.status === 'partially_applied') {
    return res.status(409).json({ error: 'This task has already published a proposal. Finish its remaining review or prepare a fresh prompt.' });
  }

  const checked = validateSeoImport(req.body?.response, run);
  if (!checked.ok) return res.status(422).json({ error: 'The pasted response did not pass the safety check.', errors: checked.errors });

  for (const target of run.targets) {
    const proposal = checked.proposals.find(item => item.key === target.key);
    target.proposal = { metaTitle: proposal.metaTitle, metaDescription: proposal.metaDescription, warnings: proposal.warnings, appliedAt: null, stale: false };
  }
  run.provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().slice(0, 80) : '';
  run.importedResponse = String(req.body.response).trim();
  run.importedAt = new Date();
  run.status = 'imported';
  await run.save();
  await recordAudit(req, 'manual_ai.imported', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType: SEO_TASK, count: run.targets.length, provider: run.provider || 'unspecified' } });
  res.json({ task: serialise(run) });
});

// POST /tasks/:id/apply — founder selects which already-validated changes to
// publish. Each source row is re-read first: any change since the prompt was
// prepared is reported as stale, never overwritten.
router.post('/tasks/:id/apply', async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Manual AI task not found.' });
  if (run.status === 'prepared') return res.status(409).json({ error: 'Import and validate an AI response before applying changes.' });
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter(key => typeof key === 'string') : [];
  if (!keys.length) return res.status(400).json({ error: 'Select at least one validated proposal to apply.' });
  if (new Set(keys).size !== keys.length) return res.status(400).json({ error: 'A proposal was selected more than once.' });

  const targetByKey = new Map(run.targets.map(target => [target.key, target]));
  if (keys.some(key => !targetByKey.has(key))) return res.status(400).json({ error: 'One selected proposal does not belong to this task.' });

  const report = [];
  for (const key of keys) {
    const target = targetByKey.get(key);
    if (!target.proposal?.metaTitle || !target.proposal?.metaDescription) { report.push({ key, status: 'skipped', reason: 'No validated proposal exists for this item.' }); continue; }
    if (target.proposal.appliedAt) { report.push({ key, status: 'skipped', reason: 'Already applied.' }); continue; }
    const claims = findOriginClaims(`${target.proposal.metaTitle}\n${target.proposal.metaDescription}`);
    if (claims.length) { report.push({ key, status: 'failed', reason: claims[0].why }); continue; }
    const current = await readSeoTarget(target.type, target.resourceId);
    if (!snapshotMatches(target, current)) {
      target.proposal.stale = true;
      report.push({ key, status: 'stale', reason: 'The page changed after this prompt was prepared. Prepare a fresh prompt instead.' });
      continue;
    }
    try {
      await saveSeoMeta({ type: target.type, id: target.resourceId, metaTitle: target.proposal.metaTitle, metaDescription: target.proposal.metaDescription, source: 'manual-ai' });
      target.proposal.appliedAt = new Date();
      target.proposal.stale = false;
      report.push({ key, status: 'applied' });
    } catch (err) {
      report.push({ key, status: 'failed', reason: err.message || 'Could not save this item.' });
    }
  }
  const proposed = run.targets.filter(target => target.proposal?.metaTitle && target.proposal?.metaDescription);
  const applied = proposed.filter(target => target.proposal.appliedAt).length;
  run.status = applied === proposed.length ? 'applied' : 'partially_applied';
  run.lastAppliedAt = new Date();
  await run.save();
  const appliedCount = report.filter(item => item.status === 'applied').length;
  if (appliedCount) await recordAudit(req, 'manual_ai.applied', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType: SEO_TASK, count: appliedCount } });
  res.json({ task: serialise(run), report });
});

module.exports = router;
