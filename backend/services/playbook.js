'use strict';

// The Playbook — the Growth Engine's shared, evolving memory of WHAT WORKS.
// The Chief of Staff distils learnings from real outcomes each week and writes
// them here; every creative agent reads them and injects them into its own
// prompt before acting. That is the loop that makes the agents adaptive: they
// don't just repeat, they bias toward what the data proved out — and they get
// sharper every cycle as the memory grows. One small store, read by all.

const SystemState = require('../models/SystemState');

const KEY = 'growthPlaybook';

// { learnings: string[], updatedAt } — short, concrete, data-derived rules.
async function getPlaybook() {
  const doc = await SystemState.findOne({ key: KEY }).lean();
  return (doc && doc.value) || { learnings: [], updatedAt: null };
}

async function setLearnings(learnings) {
  const clean = (Array.isArray(learnings) ? learnings : [])
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  const value = { learnings: clean, updatedAt: new Date().toISOString() };
  await SystemState.findOneAndUpdate({ key: KEY }, { value }, { upsert: true });
  return value;
}

// Ready-to-inject prompt block. Empty string when nothing learned yet, so a
// fresh store's agents simply behave as before.
async function playbookPromptBlock() {
  const { learnings } = await getPlaybook();
  if (!learnings.length) return '';
  return `\n\nWHAT WE'VE LEARNED WORKS (apply these — they come from real outcomes):\n${learnings.map(l => `- ${l}`).join('\n')}`;
}

module.exports = { getPlaybook, setLearnings, playbookPromptBlock };
