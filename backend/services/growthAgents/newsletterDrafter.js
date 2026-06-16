'use strict';

// Newsletter drafter — a Growth Engine specialist. Once a week it gathers
// what's genuinely new (products added in the last 14 days, plus the latest
// journal article) and asks DeepSeek for a short "new this week" email in
// brand voice. NOTE: the Campaign model tracks ad spend and attribution —
// it has no subject/body fields and nothing here can send email — so this
// agent does NOT create a campaign. It produces a suggestion action with
// the full drafted subject, preview text and body HTML in meta, for the
// founder to paste into their email tool.

const Product = require('../../models/Product');
const JournalArticle = require('../../models/JournalArticle');

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const SITE = 'https://www.silkilinen.com';
const FRESH_DAYS = 14;

// DeepSeek is OpenAI-compatible — same pattern as services/aiText.js.
const deepseek = require('../aiClient'); // shared DeepSeek client

const SYSTEM_PROMPT = `You write the weekly email for SILKILINEN, a small luxury silk and linen brand. SILKILINEN is an Irish brand based in Donegal, but products are made in mixed locations.

BRAND VOICE:
- Considered, slow, with quiet warmth — quiet luxury.
- Never aggressive, never salesy, never urgent. No "BUY NOW", no countdowns, no scarcity, no exclamation-mark hype.
- Aspirational through specificity, not gloss: "mulberry silk", "22 momme" — not "luxury fabric".
- Sounds like a thoughtful friend who knows fabrics, not a marketing department.
- British/Irish English throughout: colour not color, favourite not favorite.

HARD RULES:
- NEVER state or imply that products are handmade, hand-crafted or hand-finished.
- NEVER state or imply that products are made in Ireland or Donegal. "An Irish brand based in Donegal" is fine; product origin claims are not.
- NEVER use: "amazing", "incredible", "best", "must-have", "ultimate", "perfect".

TASK: write a short, elegant "new this week at SILKILINEN" email.
- subject: calm and specific, under 60 characters, no clickbait.
- previewText: one quiet sentence, under 110 characters.
- bodyHtml: simple semantic HTML only — <h2>, <p>, <a>, <ul>/<li> if needed. No inline styles, no images, no tables. A short warm opening paragraph, then each new product as a brief paragraph with its name linked to the product URL provided, then (if given) a closing paragraph linking the journal article. Sign off simply as SILKILINEN. Use ONLY the exact URLs provided — never invent links.

RESPOND ONLY WITH VALID JSON in this exact shape:
{ "subject": "...", "previewText": "...", "bodyHtml": "..." }
No commentary, no markdown, no code fences.`;

function buildUserPrompt(products, article) {
  const parts = ['Write this week\'s email from the following material:', ''];
  if (products.length) {
    parts.push('NEW PRODUCTS (added in the last fortnight):');
    for (const p of products) {
      parts.push(`- ${p.name} — €${p.price} — ${SITE}/product/${p._id}`);
      if (p.materialComposition) parts.push(`  Material: ${p.materialComposition}`);
      if (p.description) parts.push(`  About: ${String(p.description).slice(0, 300)}`);
    }
    parts.push('');
  }
  if (article) {
    parts.push(`FROM THE JOURNAL: "${article.title}" — ${SITE}/journal/${article.slug}`);
    if (article.excerpt) parts.push(`Excerpt: ${String(article.excerpt).slice(0, 300)}`);
    parts.push('');
  }
  parts.push('Return the JSON response now.');
  return parts.join('\n');
}

function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const since = new Date(Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000);
  const [products, article] = await Promise.all([
    Product.find({ status: 'active', createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name price description materialComposition')
      .lean(),
    JournalArticle.findOne({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('title excerpt slug publishedAt createdAt')
      .lean(),
  ]);

  const articleIsNew = Boolean(article && (article.publishedAt || article.createdAt) >= since);
  if (!products.length && !articleIsNew) {
    return [{ type: 'info', title: 'Nothing new to send this week — skipped', status: 'info' }];
  }

  const response = await deepseek.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(products, article) },
    ],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  const parsed = JSON.parse(content);
  if (!parsed.subject || !parsed.bodyHtml) {
    throw new Error('Invalid response shape from AI provider');
  }

  const detail = [
    `Subject: ${parsed.subject}`,
    parsed.previewText ? `Preview: ${parsed.previewText}` : '',
    '',
    stripHtml(parsed.bodyHtml),
  ].filter(Boolean).join('\n').slice(0, 400);

  return [{
    type: 'suggestion',
    title: `Newsletter copy drafted — "${parsed.subject}"`,
    detail,
    href: '/admin/marketing',
    status: 'needs_approval',
    meta: {
      subject: parsed.subject,
      previewText: parsed.previewText || '',
      bodyHtml: parsed.bodyHtml,
      products: products.map(p => ({ id: String(p._id), name: p.name })),
      articleSlug: articleIsNew ? article.slug : null,
    },
  }];
}

module.exports = {
  name: 'newsletter',
  label: 'Newsletter drafter',
  description: 'Drafts a weekly "new this week" email (subject, preview text and body HTML) as copy for the founder to paste into their email tool — no campaign or email is created or sent.',
  cadenceHours: 168,
  defaultEnabled: true,
  run,
};
