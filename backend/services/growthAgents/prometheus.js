'use strict';

// Prometheus — bringer of the fire of clarity. Where the inside agents work on
// strategy, Prometheus guards the HUMAN experience: he walks the storefront as
// a first-time visitor who knows nothing, and finds every place the journey is
// confusing, jargon-y, missing an answer, or a dead-end — then asks for it to
// be made clear. Knowledge, accessible to everyone.

const { gatherExperience } = require('../storefrontExperience');

const client = require('../aiClient'); // shared DeepSeek client
const { playbookPromptBlock } = require('../playbook'); // house memory (Archivarius)
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const SYSTEM = `You are Prometheus, who brings the fire of clear knowledge to people. You guard the SILKILINEN storefront's CLARITY. Walk it as a first-time visitor who knows nothing about silk or the brand. Find where the experience is confusing, where jargon goes unexplained, where an obvious question is left unanswered (sizing, fit, fabric care, shipping times, returns, what "momme" means), where a visitor wouldn't know what to do next, or where navigation is a dead-end.

Be specific and kind. Quiet-luxury voice — clarity never means dumbing down or adding clutter. Each issue must be a concrete, buildable fix.

Respond ONLY with valid JSON:
{ "issues": [ { "where": "the page/moment", "problem": "what a confused visitor experiences", "fix": "the specific clarity upgrade to build" } ] }
2-3 issues, the most confusing first. If the experience is genuinely clear, return { "issues": [] }.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  const experience = await gatherExperience();
  const learned = await playbookPromptBlock().catch(() => ''); // study the memory first

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM + learned }, { role: 'user', content: `The storefront experience:\n\n${experience}\n\nReturn the clarity issues as JSON.` }], temperature: 0.4, max_tokens: 800, response_format: { type: 'json_object' } },
      { timeout: 40000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[prometheus] failed:', err.message);
    return [{ type: 'info', title: 'Prometheus couldn\'t reach the AI this run — will retry', status: 'info' }];
  }

  const issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3) : [];
  if (!issues.length) {
    return [{ type: 'info', title: 'Prometheus walked the storefront — it reads clearly right now', status: 'info' }];
  }
  return issues.map(i => ({
    type: 'experience',
    title: `Clarity: ${String(i.where || 'the storefront')}`,
    detail: `${i.problem || ''} → Fix: ${i.fix || ''} · Tell Claude to build this.`,
    href: '/admin/growth',
    status: 'needs_approval',
    meta: { where: i.where, problem: i.problem, fix: i.fix, lens: 'clarity' },
  }));
}

module.exports = {
  name: 'prometheus',
  label: 'Prometheus · Clarity',
  description: 'Walks the storefront as a first-time visitor and finds every place the journey is confusing, jargon-y or a dead-end — so knowledge is accessible to everyone. Each finding is a "tell Claude to build this".',
  cadenceHours: 168,
  defaultEnabled: true,
  run,
};
