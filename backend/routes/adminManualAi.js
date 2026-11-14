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
const {
  TRANSLATION_TASK, COPY_TASK, IMAGE_ALT_TASK,
  getWorkflowOptions, prepareWorkflow, buildWorkflowPrompt, validateWorkflowImport,
  applyWorkflowTarget, hasProposal,
} = require('../services/manualAiAdditionalWorkflows');

const TASK_TYPES = new Set([SEO_TASK, TRANSLATION_TASK, COPY_TASK, IMAGE_ALT_TASK]);

router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function serialise(run) {
  const doc = typeof run.toObject === 'function' ? run.toObject() : run;
  const base = {
    id: String(doc._id), taskType: doc.taskType, schemaVersion: doc.schemaVersion, locale: doc.locale || '',
    status: doc.status, provider: doc.provider || '', createdAt: doc.createdAt,
    importedAt: doc.importedAt, lastAppliedAt: doc.lastAppliedAt,
  };
  if (doc.taskType !== SEO_TASK) {
    return {
      ...base,
      targets: (doc.targets || []).map(target => ({
        key: target.key, type: target.type, resourceId: target.resourceId, label: target.label, url: target.url,
        snapshot: target.snapshot?.context || {},
        proposal: hasProposal(doc.taskType, target.proposal)
          ? { fields: target.proposal.fields || null, text: target.proposal.text || '', warnings: target.proposal.warnings || [], appliedAt: target.proposal.appliedAt, stale: Boolean(target.proposal.stale) }
          : null,
      })),
    };
  }
  return {
    ...base,
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
    const requestedType = typeof req.query.taskType === 'string' ? req.query.taskType : '';
    if (requestedType && !TASK_TYPES.has(requestedType)) return res.status(400).json({ error: 'Unsupported Manual AI workflow.' });
    const filter = requestedType ? { taskType: requestedType } : { taskType: { $in: [...TASK_TYPES] } };
    const runs = await ManualAiRun.find(filter).sort({ createdAt: -1 }).limit(12).lean();
    res.json({ capabilities: TASK_CAPABILITIES, runs: runs.map(serialise) });
  } catch (err) {
    console.error('[manual-ai] list:', err.message);
    res.status(500).json({ error: 'Could not load Manual AI tasks.' });
  }
});

// GET /tasks/options/:taskType â€” only the server chooses the live records or
// images a workflow may see. The browser cannot manufacture a writable target.
router.get('/tasks/options/:taskType', async (req, res) => {
  try {
    if (![TRANSLATION_TASK, COPY_TASK, IMAGE_ALT_TASK].includes(req.params.taskType)) {
      return res.status(400).json({ error: 'Unsupported Manual AI workflow.' });
    }
    res.json(await getWorkflowOptions(req.params.taskType));
  } catch (err) {
    console.error('[manual-ai] options:', err.message);
    res.status(500).json({ error: 'Could not load workflow options.' });
  }
});

async function prepareAdditionalWorkflow(req, res, taskType) {
  try {
    const prepared = await prepareWorkflow(taskType, req.body || {});
    const run = await ManualAiRun.create({
      taskType,
      locale: prepared.locale || '',
      createdBy: req.user?.email || String(req.user?.userId || 'admin'),
      targets: prepared.targets,
    });
    await recordAudit(req, 'manual_ai.prepared', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType, locale: run.locale || undefined, count: run.targets.length } });
    res.status(201).json({ task: serialise(run), prompt: buildWorkflowPrompt(run), itemCount: run.targets.length });
  } catch (err) {
    console.error('[manual-ai] prepare:', err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not prepare this Manual AI prompt.' });
  }
}

router.post('/tasks/translation/prepare', async (req, res) => prepareAdditionalWorkflow(req, res, TRANSLATION_TASK));
router.post('/tasks/catalogue-copy/prepare', async (req, res) => prepareAdditionalWorkflow(req, res, COPY_TASK));
router.post('/tasks/image-alt/prepare', async (req, res) => prepareAdditionalWorkflow(req, res, IMAGE_ALT_TASK));

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
  try {
    const prompt = run.taskType === SEO_TASK ? buildSeoPrompt(run) : buildWorkflowPrompt(run);
    res.json({ task: serialise(run), prompt });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unsupported Manual AI workflow.' });
  }
});

// POST /tasks/:id/import — parse and validate a pasted response. This endpoint
// deliberately contains no save call for Product/Category/Collection.
router.post('/tasks/:id/import', async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Manual AI task not found.' });
  if (run.status === 'applied' || run.status === 'partially_applied') {
    return res.status(409).json({ error: 'This task has already published a proposal. Finish its remaining review or prepare a fresh prompt.' });
  }

  const checked = run.taskType === SEO_TASK
    ? validateSeoImport(req.body?.response, run)
    : validateWorkflowImport(req.body?.response, run);
  if (!checked.ok) return res.status(422).json({ error: 'The pasted response did not pass the safety check.', errors: checked.errors });

  for (const target of run.targets) {
    const proposal = checked.proposals.find(item => item.key === target.key);
    target.proposal = run.taskType === SEO_TASK
      ? { metaTitle: proposal.metaTitle, metaDescription: proposal.metaDescription, warnings: proposal.warnings, appliedAt: null, stale: false }
      : { fields: proposal.fields || null, text: proposal.text || '', warnings: proposal.warnings, appliedAt: null, stale: false };
  }
  run.provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().slice(0, 80) : '';
  run.importedResponse = String(req.body.response).trim();
  run.importedAt = new Date();
  run.status = 'imported';
  await run.save();
  await recordAudit(req, 'manual_ai.imported', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType: run.taskType, locale: run.locale || undefined, count: run.targets.length, provider: run.provider || 'unspecified' } });
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

  if (run.taskType !== SEO_TASK) {
    const report = [];
    for (const key of keys) {
      const target = targetByKey.get(key);
      if (!hasProposal(run.taskType, target.proposal)) { report.push({ key, status: 'skipped', reason: 'No validated proposal exists for this item.' }); continue; }
      if (target.proposal.appliedAt) { report.push({ key, status: 'skipped', reason: 'Already applied.' }); continue; }
      try {
        const result = await applyWorkflowTarget(run, target, target.proposal, req.user?.userId);
        if (result.status === 'stale') target.proposal.stale = true;
        if (result.status === 'applied') { target.proposal.appliedAt = new Date(); target.proposal.stale = false; }
        report.push({ key, ...result });
      } catch (err) {
        report.push({ key, status: 'failed', reason: err.message || 'Could not save this item.' });
      }
    }
    const proposed = run.targets.filter(target => hasProposal(run.taskType, target.proposal));
    const applied = proposed.filter(target => target.proposal.appliedAt).length;
    run.status = applied === proposed.length ? 'applied' : 'partially_applied';
    run.lastAppliedAt = new Date();
    await run.save();
    const appliedCount = report.filter(item => item.status === 'applied').length;
    if (appliedCount) await recordAudit(req, 'manual_ai.applied', { targetType: 'ManualAiRun', targetId: run._id, meta: { taskType: run.taskType, locale: run.locale || undefined, count: appliedCount } });
    return res.json({ task: serialise(run), report });
  }

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
