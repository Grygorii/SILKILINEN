'use strict';

// The Reasoning Clerk — the studio's fact-checker. Where the Logic Clerk asks
// "does the chain hold together?", this one asks "is any of it actually TRUE?".
// He is doubtful like hell. When an agent states a number or a market claim, he
// doesn't applaud the fireworks — he goes to the live web (real search demand,
// real trend direction) and asks whether the evidence under the claim is really
// there. A confident number with nothing beneath it is a firework; he names it.
// He pulls fresh outside evidence first, then cross-examines every notable
// claim against it, and flags the ones the world doesn't back up — with the
// concrete check the founder (or another agent) should run to settle it.
//
// Runs on Railway (open egress); in any sandbox the web calls fail soft to
// empty and he reasons from the claims alone rather than going quiet.

const GrowthAction = require('../../models/GrowthAction');
const { googleAutocomplete, googleTrendsInterest } = require('../externalData');
const { addLearning } = require('../playbook');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

// The brand's core terms — the ground the fact-checker stands on when he tests
// whether a demand or market claim is real. Live, public, free signal.
const SEEDS = ['silk robe', 'silk pyjamas', 'silk pillowcase'];

// Gather real outside evidence: what Google actually suggests people search for
// around the brand's core terms, plus each term's trend direction. Every call
// fails soft, so a blocked network just thins the evidence — it never throws.
async function gatherEvidence() {
  const lines = [];
  for (const seed of SEEDS) {
    const [suggestions, trend] = await Promise.all([
      googleAutocomplete(seed, 'IE').catch(() => []),
      googleTrendsInterest(seed, 'IE').catch(() => null),
    ]);
    const parts = [];
    if (suggestions.length) parts.push(`searches: ${suggestions.slice(0, 8).join('; ')}`);
    if (trend) parts.push(`trend: ${trend.direction}${trend.changePct != null ? ` (${trend.changePct > 0 ? '+' : ''}${trend.changePct}% vs earlier)` : ''}`);
    if (parts.length) lines.push(`"${seed}" — ${parts.join(' · ')}`);
  }
  return lines;
}

const SYSTEM = `You are the Reasoning Clerk for SILKILINEN, a quiet-luxury silk & linen house. You are the fact-checker, and you are doubtful like hell. The powerful agents make claims — demand is rising, this term is hot, customers want X, a number proves Y. Your job is NOT to be impressed by the fireworks. Your job is to ask, coldly: where is the evidence, and does it hold?

You are given the studio's recent claims and a set of LIVE WEB SIGNALS (real Google search suggestions and trend directions for the brand's core terms). Cross-examine each notable claim — especially any number, any "rising/falling", any "customers want" — against that evidence and against plain reasoning.

Verdict each one:
- "grounded": the evidence (or sound, stated reasoning) genuinely supports it.
- "shaky": plausible but unproven — the claim outruns the evidence on hand.
- "firework": an impressive-sounding claim or number with nothing real beneath it, or one the live signal actually contradicts.

Rules: doubt numbers hardest — a precise figure with no source is a classic firework. Never invent evidence; if the signal is thin, say the claim is unverified rather than passing it. Be fair — a well-reasoned claim with real signal behind it is grounded, and saying so plainly is part of the job. For every shaky/firework verdict, give the SPECIFIC check that would settle it (the search to run, the source to find, the data to pull).

Respond ONLY with valid JSON:
{ "verdicts": [ { "claim": "the claim in a few words", "agent": "which agent (if clear)", "verdict": "grounded"|"shaky"|"firework", "why": "the evidence-based reason for the verdict", "checkIt": "the concrete check to settle it (only for shaky/firework)", "lesson": "OPTIONAL, only for fireworks: a short durable rule, phrased for the other agents, to stop this class of unsupported claim (e.g. 'Never state a demand figure without citing the live search or trend signal behind it'). Omit otherwise." } ] }
Cover the 4-6 most consequential claims, fireworks first.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const actions = await GrowthAction.find({
    agent: { $nin: ['logicClerk', 'reasoningClerk'] },
    type: { $ne: 'error' },
  }).sort({ createdAt: -1 }).limit(24).select('agent type title detail').lean().catch(() => []);

  if (!actions.length) {
    return [{ type: 'info', title: 'Nothing to fact-check yet — the agents need to pulse first', status: 'info' }];
  }

  const evidence = await gatherEvidence();

  const user = [
    `LIVE WEB SIGNALS (real Google data for the brand's core terms):`,
    evidence.length ? evidence.map(e => `- ${e}`).join('\n') : '- (no live signal reached this run — reason from the claims and judge what is unverifiable as such)',
    ``,
    `THE STUDIO'S RECENT CLAIMS:`,
    actions.map(a => `- ${a.agent}: ${a.title}${a.detail ? ` — ${a.detail.slice(0, 180)}` : ''}`).join('\n'),
    ``,
    `Cross-examine. Trust nothing you can't back. Return the JSON.`,
  ].join('\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.3, max_tokens: 1200, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[reasoningClerk] verification failed:', err.message);
    return [{ type: 'info', title: 'The Reasoning Clerk couldn\'t reach the AI this run — will re-check next cycle', status: 'info' }];
  }

  const verdicts = (Array.isArray(parsed.verdicts) ? parsed.verdicts : []).filter(v => v && v.claim);
  const doubtful = verdicts.filter(v => ['shaky', 'firework'].includes(String(v.verdict).toLowerCase())).slice(0, 6);

  if (!doubtful.length) {
    const checked = verdicts.length || actions.length;
    return [{
      type: 'reasoning',
      title: `Checked out — ${checked} claim${checked === 1 ? '' : 's'} stand up to the evidence`,
      detail: `Cross-examined the studio's recent claims against live Google search demand and trend direction for the brand's core terms. No fireworks: nothing the outside evidence contradicts.${evidence.length ? '' : ' (Live signal was thin this run — re-check next cycle to confirm.)'}`,
      href: '/admin/growth',
      status: 'info',
      meta: { checked, evidenceLines: evidence.length },
    }];
  }

  // The lessons from the fireworks become shared memory — durable rules the
  // other agents read next cycle so they stop making unsupported claims.
  // Deduped and capped by addLearning; at most two per run.
  const lessons = doubtful
    .filter(v => String(v.verdict).toLowerCase() === 'firework' && v.lesson)
    .slice(0, 2);
  for (const v of lessons) await addLearning(String(v.lesson)).catch(() => {});

  return doubtful.map(v => {
    const firework = String(v.verdict).toLowerCase() === 'firework';
    return {
      type: 'reasoning',
      title: `${firework ? 'Firework' : 'Shaky claim'}: ${String(v.claim).slice(0, 80)}`,
      detail: `${v.why || 'Unsupported by the evidence on hand.'}${v.checkIt ? ` · Check it: ${v.checkIt}` : ''}${v.agent ? ` · from ${v.agent}` : ''}`,
      href: '/admin/growth',
      status: firework ? 'needs_approval' : 'info',
      meta: { verdict: firework ? 'firework' : 'shaky', agent: v.agent || '', checkIt: v.checkIt || '' },
    };
  });
}

module.exports = {
  name: 'reasoningClerk',
  label: 'Reasoning Clerk',
  description: 'Fact-checks the agents\' claims and numbers against live web evidence (real Google search demand and trends) — doubtful by design, flagging the "fireworks" (confident claims with nothing real beneath them) with the exact check to settle each.',
  cadenceHours: 48,
  defaultEnabled: true,
  run,
};
