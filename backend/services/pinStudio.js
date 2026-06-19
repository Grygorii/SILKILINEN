'use strict';

// Pin Studio — turns a journal article into ready-to-post Pinterest pins.
// Pinterest is a search engine with long-lived pins; for a visual luxury brand
// it's the highest-leverage channel to drive durable traffic to articles, which
// capture leads. Each pin = an AI IMAGE PROMPT (a scene — AI garbles text, so the
// OVERLAY HOOK is added by hand) + a Pinterest-SEO title/description + a tracked
// link. Three distinct angles per article (Pinterest rewards multiple pins/URL).

const JournalArticle = require('../models/JournalArticle');
const GrowthAction = require('../models/GrowthAction');
const { playbookPromptBlock } = require('./playbook');

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

const SYSTEM = `You are a senior Pinterest strategist for SILKILINEN, a quiet-luxury Mulberry-silk & linen house. Pinterest is a SEARCH ENGINE: titles and descriptions must be keyword-rich and specific, never salesy. You turn one journal article into THREE distinct pins, each driving a searcher to that article.

BRAND RULES (non-negotiable):
- Quiet luxury: considered, warm, specific (mulberry silk, 22 momme, slow mornings) — never "amazing/best/must-have", never urgent, never discount/sale language.
- NEVER state or imply products are made in Ireland/Donegal or are handmade — no "Irish linen", "made in Ireland". The brand is "an Irish brand based in Donegal"; product-origin claims are forbidden.
- British/Irish English.

For EACH of 3 pins produce:
- angle: the distinct approach (e.g. how-to, benefit, aesthetic/aspirational) — make the three genuinely different.
- imagePrompt: a detailed prompt for an AI image model — a VERTICAL 2:3 (1000x1500) quiet-luxury still scene fitting the article (fabric, light, texture, a styled boudoir/interior moment). Describe composition, palette, mood, lighting; leave calm negative space at the top or bottom for a text overlay. Put NO text in the image itself.
- overlayHook: the short bold line to place ON the image by hand (<= 6 words) — the curiosity or benefit hook.
- pinTitle: <= 100 chars, leads with the search keyword, calm but click-worthy.
- pinDescription: 2-3 sentences, <= 480 chars, keyword-rich for Pinterest search, weaving in 2-3 relevant keywords naturally and ending with a soft invitation to read more.
- keywords: 6-8 lowercase Pinterest search phrases (no # symbol).
- board: a short suggested board name to pin to.

Respond ONLY with valid JSON:
{ "pins": [ { "angle": "...", "imagePrompt": "...", "overlayHook": "...", "pinTitle": "...", "pinDescription": "...", "keywords": ["..."], "board": "..." } ] }`;

async function listArticles() {
  // Published first (postable now), then drafts. Pins drive to the live URL.
  return JournalArticle.find().sort({ status: 1, publishedAt: -1, createdAt: -1 }).limit(80)
    .select('title slug status publishedAt createdAt').lean();
}

async function generatePins(articleId) {
  if (!process.env.DEEPSEEK_API_KEY) return { error: 'AI is not configured.' };
  const article = await JournalArticle.findById(articleId)
    .select('title slug excerpt body keywords status').lean().catch(() => null);
  if (!article) return { error: 'Article not found.' };

  // Ground the pins in real rising demand (the chain) where it fits naturally.
  const demand = await GrowthAction.find({ agent: 'demand', type: 'demand_signal' })
    .sort({ createdAt: -1 }).limit(8).select('meta').lean().catch(() => []);
  const demandPhrases = demand.map(a => a.meta?.phrase).filter(Boolean);

  const bodyText = String(article.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
  const learned = await playbookPromptBlock().catch(() => '');

  const user = [
    `ARTICLE TITLE: ${article.title}`,
    article.keywords?.length ? `TARGET KEYWORDS: ${article.keywords.join(', ')}` : '',
    article.excerpt ? `EXCERPT: ${article.excerpt}` : '',
    `ARTICLE BODY (for context): ${bodyText}`,
    demandPhrases.length ? `REAL RISING SEARCH DEMAND (lean in where natural): ${demandPhrases.join('; ')}` : '',
    learned,
    `Create 3 distinct Pinterest pins driving searchers to this article. Return the JSON.`,
  ].filter(Boolean).join('\n\n');

  let parsed;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.7, max_tokens: 1600, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[pin-studio] generation failed:', err.message);
    return { error: 'Pin generation failed — give it a moment and try again.' };
  }

  // One tracked link per article so Pinterest traffic shows up in attribution.
  const link = `${SITE}/journal/${article.slug}?utm_source=pinterest&utm_medium=social&utm_campaign=${encodeURIComponent(article.slug)}`;
  const pins = (Array.isArray(parsed.pins) ? parsed.pins : []).slice(0, 3).map(p => ({
    angle: String(p.angle || '').slice(0, 60),
    imagePrompt: String(p.imagePrompt || '').slice(0, 1200),
    overlayHook: String(p.overlayHook || '').slice(0, 80),
    pinTitle: String(p.pinTitle || '').slice(0, 100),
    pinDescription: String(p.pinDescription || '').slice(0, 500),
    keywords: Array.isArray(p.keywords) ? p.keywords.map(String).filter(Boolean).slice(0, 8) : [],
    board: String(p.board || '').slice(0, 60),
    link,
  })).filter(p => p.imagePrompt && p.pinTitle);

  if (!pins.length) return { error: 'No usable pins came back — try again.' };
  return { article: { id: String(article._id), title: article.title, slug: article.slug, status: article.status }, pins };
}

module.exports = { generatePins, listArticles };
