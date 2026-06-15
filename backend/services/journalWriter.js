'use strict';

// Journal masterpiece writer — the on-demand, intelligence-fused article
// generator behind the "Write with AI" button in the admin journal. Where the
// weekly Content Writer agent grounds in Search Console alone, this gathers
// EVERYTHING the agents know — Hermes' SEO plan, the Demand Scout's rising
// phrases, Competitor intel, GSC opportunities and the Playbook's proven
// learnings — and writes one rankable, on-brand article that links real
// products. It saves a DRAFT; the founder reviews and publishes.

const OpenAI = require('openai');
const JournalArticle = require('../models/JournalArticle');
const Product = require('../models/Product');
const Category = require('../models/Category');
const GrowthAction = require('../models/GrowthAction');
const { playbookPromptBlock } = require('./playbook');
const { contentOutcomes } = require('./chiefOfStaff');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_SEO || 'deepseek-chat';
const SITE_URL = 'https://www.silkilinen.com';

const BRAND_RULES = `BRAND RULES (non-negotiable):
- SILKILINEN is "an Irish brand based in Donegal". Products are made in mixed locations — NEVER state or imply where any product is manufactured. NEVER use "handmade", "hand-crafted", "hand-finished", "made in Ireland" or "made in Donegal".
- British/Irish English: colour not color, favourite not favorite.
- Quiet luxury voice: considered, warm, specific. Never salesy, never urgent, never exclamation-heavy. Sounds like a thoughtful friend who knows fabrics, not a marketing department.
- Aspirational through specificity ("mulberry silk", "22 momme", "slow mornings"), never through gloss ("amazing", "best", "must-have", "ultimate", "perfect").`;

function slugify(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

async function chat(messages, maxTokens, temperature = 0.7) {
  const res = await client.chat.completions.create(
    { model: MODEL, messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' } },
    { timeout: 60000, maxRetries: 1 },
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  return JSON.parse(content);
}

// Gather everything the agents know — the whole studio's intelligence on one desk.
async function gatherIntel() {
  const [products, existing, published, categories, hermes, demand, competitor, learned, outcomes] = await Promise.all([
    Product.find({ status: 'active' }).select('name category price images image').sort({ createdAt: -1 }).limit(40).lean().catch(() => []),
    JournalArticle.find().select('title slug').lean().catch(() => []),
    JournalArticle.find({ status: 'published' }).select('title slug').sort({ publishedAt: -1 }).limit(20).lean().catch(() => []),
    Category.find({ status: 'active' }).select('slug label').lean().catch(() => []),
    GrowthAction.find({ agent: 'hermes', type: 'seo', 'meta.entityType': { $exists: true } }).sort({ createdAt: -1 }).limit(10).select('meta detail').lean().catch(() => []),
    GrowthAction.find({ agent: 'demand', type: 'demand_signal' }).sort({ createdAt: -1 }).limit(10).select('title meta').lean().catch(() => []),
    GrowthAction.find({ agent: 'competitor' }).sort({ createdAt: -1 }).limit(5).select('title').lean().catch(() => []),
    playbookPromptBlock().catch(() => ''),
    contentOutcomes().catch(() => []),
  ]);

  let gsc = [];
  try {
    const sc = require('./searchConsole');
    if (await sc.isConnected()) gsc = (await sc.getQueryOpportunities(28)).filter(r => r.impressions >= 2).slice(0, 15);
  } catch { /* optional */ }

  return {
    products,
    existing,
    published,
    categories,
    learned,
    gsc,
    // #4 — which past articles actually gained traction, so the writer leans into proven angles.
    winningAngles: (outcomes || []).filter(o => o.impressions > 20).map(o => `"${o.title}" (${o.impressions} impressions)`),
    hermesTargets: hermes.map(a => a.meta?.target).filter(Boolean),
    demandPhrases: demand.map(a => a.meta?.phrase || a.title?.replace(/^Demand wave:\s*/, '').replace(/"/g, '')).filter(Boolean),
    competitorNotes: competitor.map(a => a.title).filter(Boolean),
  };
}

// Pick the highest-value topic from the whole studio's intelligence.
async function pickTopic(intel) {
  const parsed = await chat([
    { role: 'system', content: `You are the editor for SILKILINEN's journal. ${BRAND_RULES}

You are given everything the studio's agents know. Choose ONE article topic that is the highest-value to write NOW — informational intent a silk/linen shopper would search for, that the data says we can win. Prefer a topic that is BOTH something we already rank near (Hermes / Search Console) AND something rising (Demand Scout). Never repeat an existing article.

RESPOND ONLY WITH VALID JSON: {"topic": "working title", "targetQuery": "the exact long-tail search phrase to target", "angle": "one sentence on the take", "why": "one line: the data reason this topic now"}` },
    { role: 'user', content: [
      `Hermes — queries we rank near and should win: ${intel.hermesTargets.join('; ') || '(none yet)'}`,
      `Search Console opportunities: ${intel.gsc.map(q => `"${q.query}" (${q.impressions} imp, pos ${q.position})`).join('; ') || '(none)'}`,
      `Demand Scout — rising phrases: ${intel.demandPhrases.join('; ') || '(none)'}`,
      `Competitor notes: ${intel.competitorNotes.join(' | ') || '(none)'}`,
      intel.winningAngles.length ? `PROVEN — past articles that actually gained Search Console impressions (lean into these angles): ${intel.winningAngles.join('; ')}` : '',
      `Categories we sell: ${[...new Set(intel.products.map(p => p.category).filter(Boolean))].join(', ') || 'silk pieces'}`,
      `Existing articles (do NOT repeat): ${intel.existing.map(a => a.title).join('; ') || '(none)'}`,
      ``, `Return the JSON now.`,
    ].join('\n') },
  ], 400, 0.5);
  if (!parsed.topic || !parsed.targetQuery) throw new Error('Topic pick returned an invalid shape');
  return parsed;
}

async function writeArticle(topic, intel) {
  const productList = intel.products
    .map(p => `- ${p.name} (${p.category || 'silk'}, €${p.price}) — ${SITE_URL}/product/${p._id}`)
    .join('\n');
  const categoryList = intel.categories.map(c => `- ${c.label} — ${SITE_URL}/shop?category=${c.slug}`).join('\n');
  const articleList = intel.published.map(a => `- ${a.title} — ${SITE_URL}/journal/${a.slug}`).join('\n');

  const parsed = await chat([
    { role: 'system', content: `You write masterpiece journal articles for SILKILINEN, a quiet-luxury silk & linen brand. ${BRAND_RULES}${intel.learned}

ARTICLE REQUIREMENTS:
- A magnetic HOOK in the first two sentences — a felt image or a real question, never "In today's world…".
- 800-1200 words, clean HTML (the journal stores HTML bodies): <h2>/<h3> headings (NO <h1> — the page renders the title), <p>, <ul>/<ol> where natural, <strong>/<em> sparingly, <blockquote> only if it earns it. No <html>/<head>/<body>, no inline styles, no scripts, no markdown.
- Weave in and LINK 2-4 of the provided products with <a href="EXACT_URL">natural anchor text</a>, only where genuinely relevant — never a hard sell.
- Build the internal-link web: also link ONE relevant category page and, if a genuinely related one exists, ONE existing journal article — using their exact URLs, woven naturally. This strengthens the whole site's SEO. Never force a link that doesn't fit.
- Target the search query: use it (or a close natural variant) in the opening paragraph AND at least one heading, without stuffing.
- End with a quiet, resonant closing — not a salesy CTA.
- metaTitle: 50-60 chars, leads with the target query, ends " — SILKILINEN".
- metaDescription: 140-155 chars, one or two calm sentences.
- excerpt: 1-2 sentences for the journal index, plain text.

RESPOND ONLY WITH VALID JSON: {"title": "...", "metaTitle": "...", "metaDescription": "...", "content": "<h2>...</h2><p>...</p>", "excerpt": "..."}` },
    { role: 'user', content: [
      `Write the article now.`,
      `Topic: ${topic.topic}`,
      `Target search query: ${topic.targetQuery}`,
      `Angle: ${topic.angle || '(your call)'}`,
      topic.why ? `Why this now: ${topic.why}` : '',
      ``,
      `Products you may link (use the exact URLs, pick the 2-4 most relevant):`,
      productList,
      categoryList ? `\nCategory pages you may link (pick ONE most relevant):\n${categoryList}` : '',
      articleList ? `\nExisting journal articles you may link if genuinely related (pick at most ONE):\n${articleList}` : '',
      ``, `Return the JSON now.`,
    ].filter(Boolean).join('\n') },
  ], 3000);

  for (const field of ['title', 'content']) {
    if (!parsed[field] || typeof parsed[field] !== 'string') throw new Error(`Article missing "${field}"`);
  }
  return parsed;
}

// Public entry. topic optional — when given, the founder's idea is used; else
// the editor picks the highest-value topic from the agents' intelligence.
async function generateMasterpiece({ topic } = {}) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('AI is not configured');
  const intel = await gatherIntel();
  if (intel.products.length < 2) throw new Error('Add at least two active products to link before generating an article.');

  const chosen = topic && String(topic).trim()
    ? { topic: String(topic).trim(), targetQuery: String(topic).trim(), angle: '', why: 'founder-chosen topic' }
    : await pickTopic(intel);

  const article = await writeArticle(chosen, intel);

  const existingSlugs = new Set(intel.existing.map(a => a.slug).filter(Boolean));
  const base = slugify(article.title) || slugify(chosen.topic) || 'journal-article';
  let slug = base;
  for (let i = 2; existingSlugs.has(slug); i++) slug = `${base}-${i}`;

  const linked = intel.products.filter(p => article.content.includes(`/product/${p._id}`));
  const linkedIds = linked.map(p => p.name);

  // #5 — the "why this article" line: which data/agents drove it.
  const sources = [];
  if (intel.hermesTargets.length) sources.push('Hermes SEO plan');
  if (intel.demandPhrases.length) sources.push('Demand Scout');
  if (intel.gsc.length) sources.push('Search Console');
  if (intel.winningAngles.length) sources.push('proven article angles');
  const provenance = `Targets “${chosen.targetQuery}”.${chosen.why ? ` ${chosen.why}.` : ''} Grounded in: ${sources.join(', ') || 'the catalogue'}. Links: ${linkedIds.join(', ') || 'none'}.`;

  // #1 — picture-complete draft: hero from the first linked product's primary
  // photo (real brand imagery), so the draft isn't text-only. The founder can swap it.
  let heroImage;
  for (const p of linked) {
    const img = (p.images || []).find(i => i.isPrimary && i.url) || (p.images || []).find(i => i.url);
    const url = img?.url || p.image;
    if (url) { heroImage = { url, alt: `${p.name} — SILKILINEN` }; break; }
  }

  const doc = await JournalArticle.create({
    title: article.title,
    slug,
    excerpt: article.excerpt || '',
    body: article.content,
    status: 'draft',
    ...(heroImage ? { heroImage } : {}),
    metaTitle: (article.metaTitle || '').slice(0, 70),
    metaDescription: (article.metaDescription || '').slice(0, 165),
    keywords: [chosen.targetQuery],
    lastEditedBy: 'AI · masterpiece',
    aiProvenance: provenance,
  });

  return {
    id: String(doc._id),
    title: article.title,
    targetQuery: chosen.targetQuery,
    why: chosen.why || '',
    linkedProducts: linkedIds,
  };
}

module.exports = { generateMasterpiece };
