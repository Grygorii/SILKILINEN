'use strict';

// CONTENT WRITER — Growth Engine agent.
// Once a week it writes ONE SEO journal article draft targeting a real
// long-tail search a silk/linen shopper would type. Two DeepSeek calls:
// (1) pick a fresh topic not already covered, (2) write the article in
// brand voice, linking 2-3 real products. The article is saved as a
// DRAFT JournalArticle — never published automatically.

const JournalArticle = require('../../models/JournalArticle');
const Product = require('../../models/Product');
const { playbookPromptBlock } = require('../playbook');

const deepseekClient = require('../aiClient'); // shared DeepSeek client

const MODEL = process.env.DEEPSEEK_MODEL_SEO || 'deepseek-chat';
const SITE_URL = 'https://www.silkilinen.com';

// Non-negotiable brand rules, shared by both calls.
const BRAND_RULES = `BRAND RULES (non-negotiable):
- SILKILINEN is "an Irish brand based in Donegal". Products are made in mixed locations — NEVER state or imply where any product is manufactured. NEVER use "handmade", "hand-crafted", "hand-finished", "made in Ireland" or "made in Donegal".
- British/Irish English: colour not color, favourite not favorite.
- Quiet luxury voice: considered, warm, specific. Never salesy, never urgent, never exclamation-heavy. Sounds like a thoughtful friend who knows fabrics, not a marketing department.
- Aspirational through specificity ("mulberry silk", "22 momme", "slow mornings"), never through gloss ("amazing", "best", "must-have", "ultimate", "perfect").`;

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

async function chat(messages, maxTokens) {
  const response = await deepseekClient.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  return JSON.parse(content);
}

// Real search queries from the founder's Search Console, when connected.
// These are searches Google ALREADY shows the site for — content targeting
// one of them starts from proof of demand instead of a guess. Failures
// (not connected, API hiccup, no data yet) degrade to null: the topic pick
// then falls back to editorial judgment and the action says so honestly.
async function getRealQueries() {
  try {
    const gsc = require('../searchConsole');
    if (!(await gsc.isConnected())) return null;
    const rows = await gsc.getQueryOpportunities(28);
    const usable = rows.filter(r => r.impressions >= 3);
    return usable.length ? usable.slice(0, 15) : null;
  } catch (err) {
    console.warn('[growth:content] Search Console unavailable:', err.message);
    return null;
  }
}

// Content ideas the sister agents have ALREADY vetted from real data: Hermes'
// content-gap plays (informational queries with no matching page) and the
// Demand Scout's rising waves (each with an article angle). Reading these closes
// the loop — the writer builds on the chain instead of re-deriving topics blind.
// Skips anything an existing article already targets.
async function getContentLeads(existingArticles) {
  try {
    const GrowthAction = require('../../models/GrowthAction');
    const since = new Date(Date.now() - 30 * 86400000);
    const [hermes, demand] = await Promise.all([
      GrowthAction.find({ agent: 'hermes', type: 'seo', 'meta.kind': 'content', createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).select('title meta').lean(),
      GrowthAction.find({ agent: 'demand', type: 'demand_signal', createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).select('title meta').lean(),
    ]);
    const written = new Set(existingArticles.flatMap(a => [a.title, ...(a.keywords || [])]).filter(Boolean).map(s => String(s).toLowerCase()));
    const leads = [];
    const seen = new Set();
    const add = (q, angle, source) => {
      const key = String(q || '').trim().toLowerCase();
      if (!key || written.has(key) || seen.has(key)) return;
      seen.add(key);
      leads.push({ query: String(q).trim(), angle: angle || '', source });
    };
    for (const h of hermes) add(h.meta?.target, h.meta?.action, 'Hermes (SEO content-gap)');
    for (const d of demand) add(d.meta?.phrase, (d.meta?.moves || []).join('; '), 'Demand Scout (rising wave)');
    return leads.slice(0, 8);
  } catch (err) {
    console.warn('[growth:content] lead fetch failed:', err.message);
    return [];
  }
}

async function pickTopic(existingArticles, categories, realQueries, leads = []) {
  const grounded = Boolean(realQueries && realQueries.length);
  const hasLeads = leads.length > 0;
  const parsed = await chat([
    {
      role: 'system',
      content: `You plan editorial content for SILKILINEN's journal (blog). ${BRAND_RULES}

${hasLeads
  ? `PRIORITY: your sister agents have already spotted these content opportunities from REAL data — Hermes from Search Console (gaps where an informational query has no matching page) and the Demand Scout from live rising search demand. STRONGLY prefer one of these: copy its targetQuery exactly, unless every one is a genuinely poor fit for the journal. These are pre-vetted demand — do not ignore them in favour of a fresh guess.`
  : grounded
    ? `You are given REAL search queries this site already appears for in Google (with impressions and average position). You MUST pick your targetQuery from that list — prefer informational intent, high impressions, and a weak position (above ~8) where an article can move the needle. Copy the query text exactly.`
    : `Choose ONE new long-tail informational topic a silk or linen shopper would actually search for: care guides, sleep/skin/hair benefits, fabric comparisons, styling, gifting.`}
It must NOT overlap with the existing article titles you are given.

RESPOND ONLY WITH VALID JSON: {"topic": "working title of the article", "targetQuery": "the long-tail search phrase it targets", "angle": "one sentence on the take"}`,
    },
    {
      role: 'user',
      content: [
        `Product categories we sell: ${categories.join(', ') || '(none listed)'}`,
        ``,
        hasLeads
          ? `PRIORITY content opportunities from your sister agents (prefer one of these):\n${leads.map(l => `- "${l.query}"${l.angle ? ` — angle: ${l.angle}` : ''} [${l.source}]`).join('\n')}`
          : '',
        ``,
        grounded
          ? `REAL Google queries for this site (last 28 days):\n${realQueries
              .map(q => `- "${q.query}" — ${q.impressions} impressions, avg position ${q.position}`)
              .join('\n')}`
          : `(No Search Console query data available — choose editorially.)`,
        ``,
        `Existing journal articles (do NOT repeat these topics):`,
        existingArticles.length
          ? existingArticles.map(a => `- ${a.title}`).join('\n')
          : '(none yet — anything goes)',
        ``,
        `Return the JSON now.`,
      ].join('\n'),
    },
  ], 400);

  if (!parsed.topic || !parsed.targetQuery) {
    throw new Error(`Topic pick returned invalid shape: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  // Attach provenance so the pulse feed shows the process, not just the output.
  const tq = String(parsed.targetQuery).toLowerCase();
  const leadMatch = leads.find(l => l.query.toLowerCase() === tq);
  const match = grounded ? realQueries.find(q => q.query.toLowerCase() === tq) : null;
  parsed.provenance = leadMatch
    ? `Picked up from the chain — ${leadMatch.source}: "${leadMatch.query}"`
    : match
      ? `Grounded in Search Console: "${match.query}" — ${match.impressions} impressions, avg position ${match.position}`
      : grounded
        ? 'Search Console data was provided but the model proposed its own phrasing — treat as editorial'
        : 'No Search Console query data yet — topic chosen editorially';
  return parsed;
}

async function writeArticle(topic, products) {
  const productList = products
    .map(p => `- ${p.name} (${p.category || 'silk'}, €${p.price}) — ${SITE_URL}/product/${p._id}`)
    .join('\n');

  const learned = await playbookPromptBlock();
  const parsed = await chat([
    {
      role: 'system',
      content: `You write journal articles for SILKILINEN, a small luxury silk and linen brand. ${BRAND_RULES}${learned}

ARTICLE REQUIREMENTS:
- 700-1000 words.
- "content" must be clean HTML (this is how the journal stores article bodies): <h2>/<h3> for section headings (no <h1> — the page renders the title), <p> paragraphs, <ul>/<ol> lists where natural, <strong>/<em> sparingly, <blockquote> if it earns its place. No <html>/<head>/<body> wrappers, no inline styles, no scripts, no markdown.
- Naturally mention and LINK 2-3 of the provided products using <a href="...">their exact URLs</a>, woven into the prose where genuinely relevant — never a hard sell.
- Target the given search query: use it (or close natural variants) in the opening paragraph and at least one heading, without keyword stuffing.
- metaTitle: 50-60 characters, leads with the target query, ends " — SILKILINEN".
- metaDescription: 140-155 characters, one or two calm sentences.
- excerpt: 1-2 sentences for the journal index page, plain text.

RESPOND ONLY WITH VALID JSON: {"title": "...", "metaTitle": "...", "metaDescription": "...", "content": "<h2>...</h2><p>...</p>...", "excerpt": "..."}`,
    },
    {
      role: 'user',
      content: [
        `Write the article now.`,
        ``,
        `Topic: ${topic.topic}`,
        `Target search query: ${topic.targetQuery}`,
        `Angle: ${topic.angle || '(your call)'}`,
        ``,
        `Products you may link (use the exact URLs, pick the 2-3 most relevant):`,
        productList,
        ``,
        `Return the JSON now.`,
      ].join('\n'),
    },
  ], 2500);

  for (const field of ['title', 'content']) {
    if (!parsed[field] || typeof parsed[field] !== 'string') {
      throw new Error(`Article generation missing "${field}": ${JSON.stringify(Object.keys(parsed))}`);
    }
  }
  return parsed;
}

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const [products, existingArticles] = await Promise.all([
    Product.find({ status: 'active' }).select('name category price').sort({ createdAt: -1 }).limit(30).lean(),
    JournalArticle.find().select('title slug keywords').lean(),
  ]);

  if (products.length < 2) {
    return [{
      type: 'info',
      title: 'Skipped — not enough active products to link in an article',
      status: 'info',
    }];
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const realQueries = await getRealQueries();
  const leads = await getContentLeads(existingArticles);
  const topic = await pickTopic(existingArticles, categories, realQueries, leads);
  const article = await writeArticle(topic, products);

  // Unique slug: slugified title, deduped against existing journal slugs.
  const existingSlugs = new Set(existingArticles.map(a => a.slug).filter(Boolean));
  const base = slugify(article.title) || slugify(topic.topic) || 'journal-article';
  let slug = base;
  for (let i = 2; existingSlugs.has(slug); i++) slug = `${base}-${i}`;

  const doc = await JournalArticle.create({
    title: article.title,
    slug,
    excerpt: article.excerpt || '',
    body: article.content,
    status: 'draft',
    metaTitle: (article.metaTitle || '').slice(0, 70),
    metaDescription: (article.metaDescription || '').slice(0, 165),
    keywords: [topic.targetQuery],
    lastEditedBy: 'Growth Engine',
  });

  const words = article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const linked = products.filter(p => article.content.includes(`/product/${p._id}`)).map(p => p.name);

  return [{
    type: 'article_draft',
    title: `Wrote draft: "${article.title}"`,
    detail: `${topic.provenance}. Targets "${topic.targetQuery}" · ${words} words · links to ${linked.join(', ') || 'no products'}`,
    href: `/admin/journal/${doc._id}`,
    status: 'needs_approval',
    meta: { articleId: String(doc._id), slug, targetQuery: topic.targetQuery, angle: topic.angle || '', provenance: topic.provenance },
  }];
}

module.exports = {
  name: 'content',
  label: 'Content writer',
  description: 'Writes one SEO journal article draft a week, targeting a long-tail search and linking real products. Drafts only — you approve before anything is published.',
  cadenceHours: 168,
  defaultEnabled: true,
  run,
};
