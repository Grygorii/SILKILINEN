'use strict';

// Hermes · the Pathfinder — the studio's search-performance strategist. Hermes
// is the Greek god of roads, travel and trade; Google Search Console is the map
// of the roads people actually take to reach the shop, and his job is to widen
// the ones already working and pave the ones that almost work. He reads the real
// GSC data — which queries the shop ranks for, at what position, with what CTR,
// and which pages earn the impressions — and turns it into a SHORT, RANKED plan
// of concrete moves to win more clicks from the footholds Google already grants.
//
// He looks INWARD (terms the shop already ranks for) where the Demand Scout
// looks OUTWARD (new terms the world searches) — no overlap. Calibrated for an
// early-stage site: with only a handful of impressions he says so honestly and
// names the one or two real footholds rather than inventing a grand plan. He
// gets sharper every week as the data grows, and teaches the Playbook what's
// actually ranking so the Content Writer biases toward it.
//
// Needs GSC connected (runs on Railway). Fails soft on every gather.

const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Collection = require('../../models/Collection');
const GrowthAction = require('../../models/GrowthAction');
const { isConnected, getSearchPerformance, getQueryOpportunities, getQueryPagePairs, inspectUrl, getCountryBreakdown } = require('../searchConsole');
const { serpConfigured, serpAnalysis, detectCannibalisation } = require('../seoIntel');
const { addLearning, playbookPromptBlock } = require('../playbook');
const { EDITABLE_PATHS } = require('../pageSeo');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

async function gatherContext() {
  const [perf, opps, products, categories, collections, demand, competitor, countries] = await Promise.all([
    getSearchPerformance(28).catch(() => null),
    getQueryOpportunities(28).catch(() => []),
    Product.find({ status: 'active' }).select('name category metaTitle metaDescription').lean().catch(() => []),
    Category.find({ status: 'active' }).select('slug label metaTitle metaDescription').lean().catch(() => []),
    Collection.find({ status: 'active' }).select('slug name metaTitle metaDescription').lean().catch(() => []),
    // OUTWARD intel from the other agents — read through the chain, not invented.
    GrowthAction.find({ agent: 'demand', type: 'demand_signal' }).sort({ createdAt: -1 }).limit(12).select('title meta').lean().catch(() => []),
    GrowthAction.find({ agent: 'competitor' }).sort({ createdAt: -1 }).limit(6).select('title').lean().catch(() => []),
    getCountryBreakdown(28).catch(() => []),
  ]);
  const missingMeta = products
    .filter(p => !p.metaTitle || !p.metaDescription)
    .map(p => p.name);
  const demandPhrases = demand.map(a => a.meta?.phrase || a.title?.replace(/^Demand wave:\s*/, '').replace(/"/g, '')).filter(Boolean);
  const competitorNotes = competitor.map(a => a.title).filter(Boolean);
  return { perf, opps: (opps || []).slice(0, 15), products, categories, collections, missingMeta, demandPhrases, competitorNotes, countries };
}

// Outcome tracking — did the queries Hermes flagged ~4 weeks ago actually move?
// Observational (we can't prove the founder applied each fix), so worded as
// "flagged then moved", not "our fix caused". Closes the learning loop: proven
// wins become a Playbook rule. Compares each past recommendation's baseline
// position to the query's CURRENT position.
async function assessOutcomes(currentPositions) {
  const since = new Date(Date.now() - 60 * 86400000);
  const until = new Date(Date.now() - 21 * 86400000);
  const past = await GrowthAction.find({
    agent: 'hermes', type: 'seo',
    'meta.target': { $nin: [null, ''] }, 'meta.position': { $ne: null },
    createdAt: { $gte: since, $lte: until },
  }).sort({ createdAt: -1 }).limit(40).select('meta createdAt').lean().catch(() => []);

  const cur = currentPositions instanceof Map ? currentPositions : new Map();
  const seen = new Set();
  let wins = 0, losses = 0;
  const winLines = [];
  for (const a of past) {
    const q = String(a.meta?.target || '').toLowerCase();
    const base = Number(a.meta?.position);
    if (!q || !base || seen.has(q)) continue;
    seen.add(q);
    const now = cur.get(q);
    if (now == null) continue; // not in current data — can't measure
    const delta = base - now; // positive = position improved (lower number)
    if (delta >= 1.5) { wins++; winLines.push(`"${a.meta.target}" ${base}→${now}`); }
    else if (delta <= -1.5) losses++;
  }
  return { wins, losses, measured: wins + losses, winLines: winLines.slice(0, 4) };
}

const SYSTEM = `You are Hermes, a senior search-performance strategist for SILKILINEN — a quiet-luxury silk & linen house, with 20 years' on-page and content-SEO judgement. You read the shop's REAL Google Search Console data (and, when given, the live SERP) and turn it into a short, ranked plan. You never invent numbers; you reason only over the figures handed to you.

How you think, in priority order:
1. SEARCH INTENT FIRST. Classify each target query as "informational" (how/why/care/guide), "commercial" (compare/best/vs), or "transactional" (buy/shop/specific product). The right PAGE TYPE must match the intent: transactional → a product/category page; informational → a JOURNAL guide. This decides everything below.
2. CONTENT-GAP. If a query has real impressions but its intent has NO matching page type (e.g. an informational query like "how to wash silk" that only a product page half-answers), the fix is NOT meta — it is to CREATE the right page. Emit a "content" play targeting entityType "page" /journal (a guide the Content Writer should write). Be honest: meta cannot make the wrong page type rank.
3. SERP REALITY. When you are given the live top results for a query, judge whether a meta tweak can realistically win, or whether the page is out-gunned (the top results are deep guides / comparison tables / different format). If out-gunned, say so and recommend content depth, not a title tweak.
4. STRIKING DISTANCE: queries ranking at roughly position 8-20 with real impressions, where the page type is already RIGHT. A sharper TITLE (weighted far above the meta description — Google often rewrites descriptions, so the title is the real CTR/relevance lever), an H1, one more paragraph, or an internal link can push it onto page one.
5. CANNIBALISATION: you may be given queries where TWO+ of the site's own pages compete. Splitting signals suppresses both — recommend consolidating to ONE canonical page (strengthen it, point the weaker one's internal links to it). This is a "content" play.
6. SEEN BUT NOT CLICKED: impressions, no clicks → a weak TITLE for that intent. Rewrite it to earn the click (quiet-luxury voice, never salesy).
7. META GAPS: a query mapping to a product with no meta → generate it.
8. SCHEMA: if a high-intent product/article page would benefit from structured data (Product/Article schema) for rich results, note it as a "content" play.
9. CROSS-REFERENCE THE OTHER AGENTS: fuse inward (what you rank for) with outward (Demand Scout's rising phrases, Competitor notes). A query that is BOTH striking-distance AND rising is your single highest-priority move.
10. GEOGRAPHY: you are given a per-country breakdown. The brand ships worldwide. A market with impressions but ~0 clicks SEES you yet doesn't click (locale/relevance/intent gap); a high-impression market where you rank poorly is one to invest in; a market with zero impressions hasn't discovered you. If geography reveals a genuine lever (e.g. real UK impressions but invisible in the US), name it in your "read" — but never manufacture geographic strategy from a handful of impressions.

Hard rules:
- QUIET LUXURY: never price/discount/"cheaper than", never clickbait. Aspire upward through specificity and fabric/craft detail.
- NEVER claim where a product is made; British/Irish English.
- BE HONEST ABOUT SCALE: if the impression total is tiny (early-stage), say so plainly. At that scale the truthful priority is PUBLISHING useful content + getting indexed + earning links — NOT meta tweaks. Give the 1-2 real footholds and say the rest is premature. Do not manufacture a grand plan from thin data.

Your plan is EXECUTED by a one-button "Rebuild SEO" pipeline, so each play must be machine-actionable:
- "kind" is "meta" only when rewriting an EXISTING page's meta title/description fixes it (pipeline generates+applies). Use "content" for anything else — a new guide, more on-page words, an internal link, consolidating cannibalised pages, schema (pipeline drafts/flags it).
- "entityType" + "entityRef": product → exact product NAME; category/collection → SLUG; page → an exact editable path. For a content-gap guide, use entityType "page", entityRef "/journal".
- AT MOST ONE play per entity. Dedupe ruthlessly.

Respond ONLY with valid JSON:
{
  "state": "thin" | "actionable",
  "read": "one honest sentence on the search picture, including the single biggest strategic lever right now (not necessarily meta)",
  "plays": [ { "target": "the query/intent", "intent": "informational" | "commercial" | "transactional", "kind": "meta" | "content", "entityType": "product" | "category" | "collection" | "page", "entityRef": "name/slug/path", "position": number|null, "impressions": number|null, "issue": "what's really holding it back (intent mismatch? out-gunned on the SERP? cannibalisation? weak title?)", "action": "the one concrete instruction", "leverage": "high" | "low" } ],
  "lesson": "OPTIONAL: one durable, reusable rule for the other agents. Omit if nothing durable yet."
}
Give at most 6 plays, highest leverage first, one per entity.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  if (!(await isConnected().catch(() => false))) {
    return [{
      type: 'info',
      title: 'Hermes is waiting on Search Console',
      detail: 'Connect Google Search Console (Dashboard → Search performance → Connect) and Hermes will start mapping the searches people already use to find you, and how to win more clicks from them.',
      href: '/admin',
      status: 'info',
    }];
  }

  const { perf, opps, products, categories, collections, missingMeta, demandPhrases, competitorNotes, countries } = await gatherContext();
  const impressions = perf?.totals?.impressions || 0;
  if (!perf || impressions === 0) {
    return [{
      type: 'info',
      title: 'No search footholds yet — Hermes is watching',
      detail: 'Google isn\'t showing the shop for any searches yet. The work now is publishing and demand-building; the moment real impressions appear, Hermes will map them into a plan to win clicks.',
      href: '/admin/growth',
      status: 'info',
    }];
  }

  // Senior analyses the on-page-only Hermes was missing — all fail soft.
  const pairs = await getQueryPagePairs(28).catch(() => []);
  const cannibal = detectCannibalisation(pairs);
  // Current best position per query — from the full query×page set (far wider
  // than the top-15 opportunities), so outcome tracking can actually measure.
  const currentPositions = new Map();
  for (const r of pairs) {
    const q = String(r.query || '').toLowerCase();
    if (!q) continue;
    if (!currentPositions.has(q) || r.position < currentPositions.get(q)) currentPositions.set(q, r.position);
  }
  const strikers = (opps || []).filter(o => o.position >= 6 && o.position <= 20)
    .sort((a, b) => b.impressions - a.impressions).slice(0, 2);
  let serp = [];
  if (serpConfigured()) serp = await Promise.all(strikers.map(async o => ({ query: o.query, ...(await serpAnalysis(o.query)) }))).catch(() => []);
  const host = (perf.topPages || []).map(p => p.key).find(u => /^https?:/.test(u))?.match(/^https?:\/\/[^/]+/)?.[0] || 'https://www.silkilinen.com';
  const keyUrls = [`${host}/`, products[0] && `${host}/product/${products[0]._id}`, categories[0] && `${host}/shop?category=${categories[0].slug}`].filter(Boolean).slice(0, 4);
  const indexation = await Promise.all(keyUrls.map(async u => ({ url: u.replace(host, '') || '/', ...(await inspectUrl(u) || { indexed: null }) }))).catch(() => []);
  const notIndexed = indexation.filter(i => i.indexed === false);

  const learned = await playbookPromptBlock().catch(() => '');
  const user = [
    `SEARCH PICTURE (last 28 days, finalised): ${perf.totals.clicks} clicks, ${impressions} impressions, avg position ${Math.round(perf.totals.position)}. This is an early-stage site — calibrate honestly to this scale.`,
    ``,
    `QUERIES THE SHOP RANKS FOR (position, impressions — the raw material for striking-distance and near-miss plays):`,
    opps.length ? opps.map(o => `- "${o.query}" — position ${o.position}, ${o.impressions} imp, ${o.clicks} clk`).join('\n') : '- none surfaced yet',
    ``,
    `TOP PAGES (where impressions/clicks land — read these for "seen but not clicked"):`,
    (perf.topPages || []).length ? perf.topPages.map(p => `- ${p.key.replace(/^https?:\/\/[^/]+/, '') || '/'} — ${p.impressions} imp, ${p.clicks} clk`).join('\n') : '- none yet',
    ``,
    `GEOGRAPHIC PICTURE (which countries Google shows the shop in — ISO codes; SILKILINEN ships worldwide, so reason about market footholds):`,
    countries.length ? countries.map(c => `- ${String(c.country).toUpperCase()} — ${c.impressions} imp, ${c.clicks} clk, avg pos ${c.position}`).join('\n') : '- no geographic data yet',
    ``,
    `PRODUCTS (entityType "product" — use the exact name as entityRef): ${products.map(p => p.name).slice(0, 30).join(', ') || 'none'}.`,
    `CATEGORIES (entityType "category" — use the slug as entityRef): ${categories.map(c => `${c.slug} (${c.label})`).join(', ') || 'none'}.`,
    `COLLECTIONS (entityType "collection" — use the slug as entityRef): ${collections.map(c => `${c.slug} (${c.name})`).join(', ') || 'none'}.`,
    `EDITABLE PAGES (entityType "page" — use one of these EXACT paths as entityRef; a "meta" play here can now be auto-applied): ${EDITABLE_PATHS.join(', ')}.`,
    missingMeta.length ? `PRODUCTS MISSING META (competing one-handed — prioritise a "meta" play): ${missingMeta.slice(0, 12).join(', ')}.` : 'All active products have meta.',
    ``,
    `OUTWARD INTEL FROM THE OTHER AGENTS (read through the chain — use it, don't ignore it):`,
    demandPhrases.length ? `- Demand Scout — rising/searched phrases the world wants: ${demandPhrases.slice(0, 12).join('; ')}.` : '- Demand Scout: nothing fresh.',
    competitorNotes.length ? `- Competitor Scout: ${competitorNotes.slice(0, 4).join(' | ')}.` : '',
    `CROSS-REFERENCE RULE: if one of your striking-distance queries also appears in (or closely matches) the Demand Scout's rising phrases, RAISE its leverage to "high" and say so in the issue — inward foothold + outward demand is the strongest signal there is.`,
    ``,
    `── SENIOR SIGNALS ──`,
    cannibal.length
      ? `CANNIBALISATION (your OWN pages competing for one query — splitting signals; recommend consolidating to one):\n${cannibal.map(c => `- "${c.query}": ${c.pages.map(p => `${p.page.replace(/^https?:\/\/[^/]+/, '')} (pos ${p.position})`).join(', ')}`).join('\n')}`
      : 'CANNIBALISATION: none detected.',
    serp.length
      ? `LIVE SERP for your striking-distance queries (judge realistically — can a meta tweak win, or are you out-gunned by deeper content?):\n${serp.map(s => `- "${s.query}": ${s.configured ? (s.results.map(r => `[${r.displayLink}] ${r.title}`).join(' | ') || 'no results returned') : 'SERP API not configured'}`).join('\n')}`
      : (serpConfigured() ? '' : 'LIVE SERP: not configured — reason about likely intent/format from your own knowledge (founder can set GOOGLE_CSE_KEY + GOOGLE_CSE_ID to feed real SERPs).'),
    notIndexed.length
      ? `NOT INDEXED — these key pages are NOT confirmed in Google's index, so meta/content tweaks cannot rank them until fixed: ${notIndexed.map(i => i.url).join(', ')}.`
      : '',
    learned,
    ``,
    `Read the picture and return the ranked plan as JSON.`,
  ].join('\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.4, max_tokens: 1100, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[hermes] analysis failed:', err.message);
    return [{ type: 'info', title: 'Hermes couldn\'t reach the AI this run — will map again next cycle', status: 'info' }];
  }

  // Keep one play per entity (Hermes is told to dedupe, but enforce it too).
  const seen = new Set();
  const plays = (Array.isArray(parsed.plays) ? parsed.plays : [])
    .filter(p => p && (p.target || p.entityRef))
    .filter(p => {
      const key = `${String(p.entityType || '').toLowerCase()}:${String(p.entityRef || p.target || '').toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);

  // Teach the Playbook what's ranking, so the Content Writer leans into it.
  if (parsed.lesson) await addLearning(String(parsed.lesson)).catch(() => {});

  if (!plays.length) {
    return [{
      type: 'seo',
      title: `Hermes: ${parsed.read ? String(parsed.read).slice(0, 90) : 'search read logged, no action this run'}`,
      detail: `${parsed.read || ''} Too few signals to act on yet — keep publishing and Hermes will map footholds as they appear.`,
      href: '/admin/growth',
      status: 'info',
      meta: { state: parsed.state || 'thin', impressions },
    }];
  }

  const mapped = plays.map(p => {
    const high = String(p.leverage).toLowerCase() === 'high';
    const kind = String(p.kind || '').toLowerCase() === 'content' ? 'content' : 'meta';
    const entityType = ['product', 'category', 'collection', 'page'].includes(String(p.entityType || '').toLowerCase())
      ? String(p.entityType).toLowerCase() : 'page';
    const entityRef = String(p.entityRef || '').trim();
    const intent = ['informational', 'commercial', 'transactional'].includes(String(p.intent || '').toLowerCase())
      ? String(p.intent).toLowerCase() : '';
    const pos = p.position != null ? ` (pos ${p.position}${p.impressions != null ? `, ${p.impressions} imp` : ''})` : '';
    return {
      type: 'seo',
      title: `Hermes: ${String(p.target || entityRef).slice(0, 80)}`,
      detail: `${intent ? `[${intent}] ` : ''}${p.issue || ''}${pos}${entityRef ? ` · ${entityType}: ${entityRef}` : ''} · Do this: ${p.action || 'improve this page for the query'}`,
      href: '/admin/seo',
      status: high ? 'needs_approval' : 'info',
      // Structured so the Rebuild SEO pipeline can execute the plan.
      meta: {
        kind, entityType, entityRef, intent,
        target: p.target || '', action: p.action || '',
        position: p.position ?? null, impressions: p.impressions ?? null,
        leverage: high ? 'high' : 'low',
      },
    };
  });

  // Strategic flags the pipeline can't auto-apply but the founder must see —
  // surfaced as their own blocks (kind 'content', so Rebuild flags them).
  const extra = [];
  for (const c of cannibal.slice(0, 3)) {
    extra.push({
      type: 'seo',
      title: `Cannibalisation: "${String(c.query).slice(0, 70)}"`,
      detail: `${c.pages.length} of your own pages compete for this query (${c.pages.map(p => `${p.page.replace(/^https?:\/\/[^/]+/, '')} pos ${p.position}`).join(', ')}). Consolidate to one strong page and point the weaker ones' internal links to it.`,
      href: '/admin/seo',
      status: 'needs_approval',
      meta: { kind: 'content', entityType: 'page', entityRef: '', target: c.query, action: 'consolidate competing pages to one canonical page', leverage: 'high', strategic: 'cannibalisation' },
    });
  }
  if (notIndexed.length) {
    extra.push({
      type: 'seo',
      title: `Not indexed: ${notIndexed.length} key page${notIndexed.length === 1 ? '' : 's'} missing from Google`,
      detail: `${notIndexed.map(i => i.url).join(', ')} — not confirmed in Google's index. Request indexing in Search Console (URL Inspection → Request indexing); no meta/content tweak can rank an unindexed page.`,
      href: '/admin',
      status: 'needs_approval',
      meta: { kind: 'content', entityType: 'page', entityRef: '', strategic: 'indexation' },
    });
  }

  // Outcome loop — measure queries flagged ~4 weeks ago, learn from the wins.
  const outcome = await assessOutcomes(currentPositions);
  if (outcome.measured > 0) {
    extra.unshift({
      type: 'seo',
      title: `Outcome check: ${outcome.wins} of ${outcome.measured} flagged queries improved`,
      detail: `Of the queries Hermes flagged ~4 weeks ago that are still measurable, ${outcome.wins} moved up and ${outcome.losses} slipped.${outcome.winLines.length ? ` Movers: ${outcome.winLines.join(', ')}.` : ''} (Observational — confirms the direction, not strict cause.)`,
      href: '/admin/seo',
      status: 'info',
      meta: { strategic: 'outcomes', wins: outcome.wins, losses: outcome.losses },
    });
    if (outcome.winLines.length) {
      await addLearning(`Search Console shows these flagged queries improved after action: ${outcome.winLines.join('; ')} — keep prioritising this kind of fix.`).catch(() => {});
    }
  }

  return [...mapped, ...extra];
}

module.exports = {
  name: 'hermes',
  label: 'Hermes · Pathfinder',
  description: 'Senior search strategist: reads real Search Console data, classifies intent, checks the live SERP (when configured), catches cannibalisation, flags un-indexed pages, and measures whether past fixes actually moved — then ranks what to do (content gaps, titles, meta, consolidation), fused with the Demand & Competitor scouts. The brain behind Rebuild SEO.',
  cadenceHours: 72,
  defaultEnabled: true,
  run,
};
