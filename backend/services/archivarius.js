'use strict';

// ARCHIVARIUS — the librarian of the house's living memory.
//
// The loop the founder asked for: every agent (and the clerks, who catch the
// mistakes) feeds Archivarius; it reinforces what recurs and surfaces it back —
// wins to apply, PITFALLS to avoid, and verified facts — into every agent's
// prompt, so the team gets more knowledgeable and stops repeating errors.
//
// Replaces the old 12-item Playbook: the same playbook.js functions now delegate
// here, so every existing agent reads this richer memory with no change.

const MemoryEntry = require('../models/MemoryEntry');

const MAX_ENTRIES = 140; // far larger than the old cap; pruned by weight, not size

function normKey(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

// Add a memory, or REINFORCE it if we've seen it before (weight + hits grow).
async function remember({ kind = 'lesson', text, detail = '', source = '', tags = [] } = {}) {
  const clean = String(text || '').trim();
  const key = normKey(clean);
  if (!clean || key.length < 4) return null;
  try {
    const existing = await MemoryEntry.findOne({ kind, textKey: key });
    if (existing) {
      existing.weight += 1; existing.hits += 1; existing.lastSeen = new Date();
      if (detail && detail.length > (existing.detail || '').length) existing.detail = detail.slice(0, 500);
      if (tags.length) existing.tags = [...new Set([...(existing.tags || []), ...tags])].slice(0, 8);
      await existing.save();
      return existing;
    }
    return await MemoryEntry.create({
      kind, text: clean.slice(0, 300), textKey: key, detail: String(detail).slice(0, 500),
      source: String(source).slice(0, 40), tags: tags.slice(0, 8), weight: 1, hits: 1, lastSeen: new Date(),
    });
  } catch (err) {
    // Unique-race: another write created it first — reinforce instead.
    if (err.code === 11000) {
      await MemoryEntry.updateOne({ kind, textKey: key }, { $inc: { weight: 1, hits: 1 }, $set: { lastSeen: new Date() } }).catch(() => {});
      return null;
    }
    console.warn('[archivarius] remember failed:', err.message);
    return null;
  }
}

// The strongest, most-relevant memory.
async function recall({ kinds = ['lesson', 'pitfall', 'fact', 'decision'], tags = [], limit = 18 } = {}) {
  const q = { kind: { $in: kinds } };
  if (tags.length) q.tags = { $in: tags };
  return MemoryEntry.find(q).sort({ weight: -1, lastSeen: -1 }).limit(limit).lean().catch(() => []);
}

// The prompt block injected into every agent — wins AND mistakes-to-avoid AND
// verified facts. This is what makes the memory powerful, not just a wins list.
async function memoryBlock({ tags = [] } = {}) {
  const entries = await recall({ tags, limit: 22 });
  if (!entries.length) return '';
  const by = k => entries.filter(e => e.kind === k);
  const lessons = by('lesson').slice(0, 8);
  const pitfalls = by('pitfall').slice(0, 6);
  const facts = by('fact').slice(0, 4);
  const decisions = by('decision').slice(0, 3);
  let out = '\n\n— ARCHIVARIUS (the house memory; apply it) —';
  if (lessons.length) out += `\nWHAT WORKS (proven by real outcomes):\n${lessons.map(l => `- ${l.text}`).join('\n')}`;
  if (pitfalls.length) out += `\nMISTAKES TO AVOID (we got these wrong before — do NOT repeat):\n${pitfalls.map(p => `- ${p.text}`).join('\n')}`;
  if (decisions.length) out += `\nDECISIONS TO HONOUR:\n${decisions.map(d => `- ${d.text}`).join('\n')}`;
  if (facts.length) out += `\nVERIFIED FACTS (don't contradict):\n${facts.map(f => `- ${f.text}`).join('\n')}`;
  return out;
}

// THE LOOP — learn from the clerks (who catch mistakes) and the watchdog (risks).
// Recent flags become PITFALLS; recurring ones gain weight and rise to the top.
async function ingestRecentFindings(sinceHours = 72) {
  const GrowthAction = require('../models/GrowthAction');
  const since = new Date(Date.now() - sinceHours * 3600000);
  const actions = await GrowthAction.find({
    agent: { $in: ['logicClerk', 'reasoningClerk', 'watchdog'] },
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 }).limit(40).select('agent type title detail meta').lean().catch(() => []);

  let added = 0;
  for (const a of actions) {
    const m = a.meta || {};
    const isFlag = m.severity === 'high' || m.verdict === 'firework' || m.verdict === 'shaky' || a.agent === 'watchdog';
    if (!isFlag) continue;
    // Trim the clerk's prefix so the memory reads as a lesson, not a log line.
    const text = String(a.title || '').replace(/^(Logic flag:|Reasoning:|Alert:)\s*/i, '').slice(0, 200);
    if (await remember({ kind: 'pitfall', text, detail: a.detail, source: a.agent })) added++;
  }
  return added;
}

// Keep memory sharp: prune the weakest beyond the cap (low weight + stale first).
async function prune(max = MAX_ENTRIES) {
  const count = await MemoryEntry.countDocuments().catch(() => 0);
  if (count <= max) return 0;
  const drop = await MemoryEntry.find().sort({ weight: 1, lastSeen: 1 }).limit(count - max).select('_id').lean().catch(() => []);
  if (!drop.length) return 0;
  await MemoryEntry.deleteMany({ _id: { $in: drop.map(d => d._id) } }).catch(() => {});
  return drop.length;
}

// Called from the growth pulse: learn from this cycle's flags, then stay sharp.
async function tick() {
  const added = await ingestRecentFindings().catch(() => 0);
  await prune().catch(() => {});
  return { added };
}

async function stats() {
  const [total, lesson, pitfall, fact, decision, top] = await Promise.all([
    MemoryEntry.countDocuments().catch(() => 0),
    MemoryEntry.countDocuments({ kind: 'lesson' }).catch(() => 0),
    MemoryEntry.countDocuments({ kind: 'pitfall' }).catch(() => 0),
    MemoryEntry.countDocuments({ kind: 'fact' }).catch(() => 0),
    MemoryEntry.countDocuments({ kind: 'decision' }).catch(() => 0),
    MemoryEntry.find().sort({ weight: -1, lastSeen: -1 }).limit(60).lean().catch(() => []),
  ]);
  return { counts: { total, lesson, pitfall, fact, decision }, top };
}

module.exports = { remember, recall, memoryBlock, ingestRecentFindings, prune, tick, stats };
