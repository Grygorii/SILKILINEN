'use strict';

// The Logic Clerk — the studio's auditor. The other agents are the powerful
// ones: they observe, invent, conduct, create. The Clerk does the humble,
// essential job they can't do for themselves — he DOUBTS them. He takes
// everything they just produced, lays it out as a chain (each agent's claim a
// block, hashed onto the one before it — a small honest blockchain of what was
// said), and walks the chain link by link asking one question: does this still
// make logic? Where one agent contradicts another, or any of them contradicts
// the real catalogue and the real numbers, that's a broken link — and he flags
// exactly where it is, and what to fix. A chain is only as strong as its
// weakest link; his job is to find the weak link before the founder does.

const crypto = require('crypto');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const CEOBrief = require('../../models/CEOBrief');
const GrowthAction = require('../../models/GrowthAction');
const { northStarStatus } = require('../chiefOfStaff');
const { addLearning } = require('../playbook');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

// The ground truth the chain is checked against — what is ACTUALLY true of the
// shop right now. Any agent claim that fights these facts is a broken link.
async function gatherTruth() {
  const [cats, priceAgg, star, brief] = await Promise.all([
    Category.find({ status: 'active' }).select('label').lean().catch(() => []),
    Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out'] } } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, n: { $sum: 1 } } },
    ]).catch(() => []),
    northStarStatus().catch(() => null),
    CEOBrief.findOne().sort({ createdAt: -1 }).select('headline progress whatsWorking').lean().catch(() => null),
  ]);
  const p = priceAgg[0] || {};
  return [
    `Catalogue: ${p.n || 0} products, prices ${p.min != null ? `€${Math.round(p.min)}–€${Math.round(p.max)}` : 'unknown'}. Material is SILK (and linen) only — there is no other material in the shop.`,
    `Categories: ${cats.map(c => c.label).join(', ') || 'silk pieces'}.`,
    star ? `The goal (AI Star): ${star.label} — ${star.current ?? '?'} / ${star.target} (${star.pct ?? 0}%), pace ${star.pace}.` : 'The goal (AI Star): not set.',
    brief ? `Latest brief said: "${brief.headline}" — progress: ${brief.progress}` : 'No brief on record yet.',
  ];
}

// Build the chain: oldest action first, each block's ref hashed onto the
// previous block's ref. Tamper-evident by construction — and, laid out for the
// auditor, the exact line he walks looking for the link that doesn't hold.
function buildChain(actions) {
  const ordered = [...actions].reverse(); // oldest → newest
  let prev = '000000000000';
  return ordered.map((a, i) => {
    const claim = `${a.title}${a.detail ? ' — ' + a.detail.slice(0, 200) : ''}`;
    const ref = crypto.createHash('sha256').update(prev + a.agent + claim).digest('hex').slice(0, 12);
    const block = { n: i + 1, ref, agent: a.agent, type: a.type, claim };
    prev = ref;
    return block;
  });
}

const SYSTEM = `You are the Logic Clerk for SILKILINEN, a quiet-luxury silk & linen house. You are not one of the powerful creative agents — you are the auditor who DOUBTS them. You are handed a CHAIN: every claim the agents just produced, in order, each block hashed onto the one before it. You are also handed the GROUND TRUTH — what is actually true of the shop right now.

Walk the chain link by link. Your only job is to find where the logic breaks:
- One agent contradicts another (e.g. one says a product is a bestseller, another says it has no stock and no sales).
- An agent's claim fights the ground truth (e.g. claims a material, price, or category the shop doesn't have; cites a number the real metrics don't support).
- A recommendation doesn't follow from its own stated reason, or assumes something not on the chain.
- A claim repeats stale information the newer blocks already overtook.

Be exact and be fair: flag a block ONLY when you can name the specific conflict and point to the block(s) involved by ref. Do not invent problems to look busy — a clean chain is a real and good result. Never flag a difference of taste or strategy; only flag broken LOGIC.

Respond ONLY with valid JSON:
{ "chainOk": true|false,
  "findings": [ { "blocks": ["ref","ref"], "issue": "the exact contradiction or logic break, naming what fights what", "fix": "the concrete thing to change so the link holds", "severity": "high"|"low", "lesson": "OPTIONAL: only for a real, repeatable mistake — a short durable rule, phrased for the other agents, that would PREVENT this whole class of error next time (e.g. 'Never call a product a bestseller without checking it has current stock and recent sales'). Omit for one-off slips with no general lesson." } ] }
Order findings worst first. If the chain holds, return chainOk true and an empty findings array.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  // The clerk audits the OTHER agents — never his own findings (no infinite
  // mirror) and never raw error rows.
  const actions = await GrowthAction.find({
    agent: { $nin: ['logicClerk', 'reasoningClerk'] },
    type: { $ne: 'error' },
  }).sort({ createdAt: -1 }).limit(30).select('agent type title detail').lean().catch(() => []);

  if (actions.length < 2) {
    return [{ type: 'info', title: 'Nothing to audit yet — the agents need to pulse first', status: 'info' }];
  }

  const chain = buildChain(actions);
  const truth = await gatherTruth();
  const head = chain[chain.length - 1].ref;

  const user = [
    `GROUND TRUTH (what is actually true now):`,
    truth.map(t => `- ${t}`).join('\n'),
    ``,
    `THE CHAIN (${chain.length} blocks, oldest → newest; head ref ${head}):`,
    chain.map(b => `[${b.ref}] ${b.agent} (${b.type}): ${b.claim}`).join('\n'),
    ``,
    `Walk the chain. Find the broken links. Return the JSON.`,
  ].join('\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.2, max_tokens: 1100, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[logicClerk] audit failed:', err.message);
    return [{ type: 'info', title: 'The Logic Clerk couldn\'t reach the AI this run — will re-audit next cycle', status: 'info' }];
  }

  const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .filter(f => f && f.issue)
    .slice(0, 6);

  if (!findings.length) {
    return [{
      type: 'audit',
      title: `Chain holds — ${chain.length} blocks audited, no broken links`,
      detail: `Walked the full chain of agent output against the live catalogue, prices, the AI Star and the latest brief. Every link is consistent. Head ref ${head}.`,
      href: '/admin/growth',
      status: 'info',
      meta: { chainLength: chain.length, head },
    }];
  }

  // Feed the lessons from the serious findings back into the shared Playbook,
  // so the other agents read them next cycle and stop repeating the mistake —
  // the verification layer teaching the studio, not just policing it. addLearning
  // dedupes and caps, so this can't flood the memory; at most two per run.
  const lessons = findings
    .filter(f => String(f.severity).toLowerCase() === 'high' && f.lesson)
    .slice(0, 2);
  for (const f of lessons) await addLearning(String(f.lesson)).catch(() => {});

  return findings.map(f => {
    const refs = Array.isArray(f.blocks) ? f.blocks.filter(Boolean) : [];
    const high = String(f.severity).toLowerCase() === 'high';
    return {
      type: 'audit',
      title: `Logic flag: ${String(f.issue).slice(0, 90)}`,
      detail: `${f.issue}${f.fix ? ` · Fix: ${f.fix}` : ''}${refs.length ? ` · Blocks ${refs.join(', ')}` : ''}`,
      href: '/admin/growth',
      status: high ? 'needs_approval' : 'info',
      meta: { blocks: refs, severity: high ? 'high' : 'low', fix: f.fix || '', head },
    };
  });
}

module.exports = {
  name: 'logicClerk',
  label: 'Logic Clerk',
  description: 'Audits every other agent\'s output as a hashed chain (a small honest blockchain) and walks it link by link, flagging exactly where one claim contradicts another or the real catalogue, prices and metrics.',
  cadenceHours: 24,
  defaultEnabled: true,
  run,
};
