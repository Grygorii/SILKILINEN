'use strict';

// The Playbook is now a thin facade over ARCHIVARIUS (services/archivarius.js) —
// the living, structured memory that replaced the old flat 12-item list. These
// functions keep their old names + signatures so every existing agent and the
// Chief of Staff work unchanged, but they now read/write the richer memory
// (wins + mistakes-to-avoid + verified facts), and writing REINFORCES rather
// than overwrites.

const archivarius = require('./archivarius');

// One freshly-learned rule → a lesson in the memory (reinforced if seen before).
async function addLearning(text, source = 'agent') {
  return archivarius.remember({ kind: 'lesson', text, source });
}

// A batch of distilled learnings (the Chief's weekly set) → reinforced lessons.
async function mergeLearnings(newOnes, source = 'chief') {
  const list = Array.isArray(newOnes) ? newOnes : [];
  for (const t of list) await archivarius.remember({ kind: 'lesson', text: t, source });
  return { count: list.length };
}

// Back-compat: old callers used setLearnings to overwrite. It now reinforces
// (never wipes Hermes'/the clerks' memory) — the same as merge.
const setLearnings = mergeLearnings;

// The prompt block injected into the creative agents — now wins AND pitfalls AND
// facts, not just a wins list.
async function playbookPromptBlock(opts = {}) {
  return archivarius.memoryBlock(opts);
}

// Back-compat shape for any reader expecting { learnings: string[] }.
async function getPlaybook() {
  const lessons = await archivarius.recall({ kinds: ['lesson'], limit: 12 });
  return { learnings: lessons.map(l => l.text), updatedAt: lessons[0]?.lastSeen || null };
}

module.exports = { getPlaybook, setLearnings, mergeLearnings, addLearning, playbookPromptBlock };
