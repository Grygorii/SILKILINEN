'use strict';

// AI SEARCH VISIBILITY — are we in the answer when a shopper asks an AI?
//
// Asks the buyer-intent questions people actually type, then records three
// things per answer: was SILKILINEN NAMED, was silkilinen.com CITED as a
// source, and which competitors were recommended instead. That last one is the
// most actionable output — it names the brands whose mentions we need to earn.
//
// Providers:
//   • gemini   — with Google Search grounding, so citations are REAL sources.
//   • deepseek — no live search; reflects what the model "knows" (training recall).
// Honest limits: Google's AI Overviews / AI Mode have no public API, so they are
// deliberately NOT estimated here (the only way is scraping SERPs, which we don't
// do). ChatGPT is only included if OPENAI_API_KEY is set, and the API differs
// from the consumer product with browsing.
//
// Fail-soft per query: one bad call never sinks the run.

const { GoogleGenAI } = require('@google/genai');
const deepseek = require('./aiClient');
const AiVisibility = require('../models/AiVisibility');
const CompetitorProfile = require('../models/CompetitorProfile');

const GEMINI_MODEL = process.env.GEMINI_VISIBILITY_MODEL || 'gemini-2.5-flash';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const BRAND = 'silkilinen';
const SITE_DOMAIN = 'silkilinen.com';

// The questions a real buyer would ask an assistant. Kept tight so a run stays
// affordable; edit here to track different intents.
const PROMPTS = [
  'What are the best luxury silk pyjama brands to buy right now?',
  'Where can I buy a pure mulberry silk robe in Europe?',
  'Best silk underwear brands for sensitive or eczema-prone skin?',
  'Which brands make the best 22-momme silk pillowcases?',
  'Recommend an Irish silk and linen clothing brand.',
  'Best quiet-luxury sleepwear brands that are not fast fashion.',
  'Where should I buy silk bikini briefs or knickers online?',
  'What is a good gift of luxury silk nightwear for a woman?',
  'Which small independent brands sell pure mulberry silk intimates?',
  'Best silk slip dress brands shipping worldwide?',
];

// Well-known names used only when no competitors have been discovered yet —
// the live CompetitorProfile list is always preferred.
const FALLBACK_COMPETITORS = [
  'Olivia von Halle', 'Lunya', 'Quince', 'Eberjey', 'Intimissimi',
  'La Perla', 'Slip', 'Cuyana', 'Nap Loungewear', 'Lilysilk', 'Mulberry Park',
];

function geminiReady() { return Boolean(process.env.GEMINI_API_KEY); }
function deepseekReady() { return Boolean(process.env.DEEPSEEK_API_KEY); }
function genai() { return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); }

// Ask Gemini WITH Google Search grounding so the sources are real.
async function askGemini(prompt) {
  const result = await genai().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  const text = result.text || result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks
    .map(c => ({ title: String(c.web?.title || '').slice(0, 160), uri: String(c.web?.uri || '').slice(0, 400) }))
    .filter(s => s.uri || s.title);
  return { text, sources };
}

// DeepSeek has no live search — this measures training-data recall, not citations.
async function askDeepSeek(prompt) {
  const res = await deepseek.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: 'You are a helpful shopping assistant. Recommend specific real brands by name, as you would to a shopper.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3, max_tokens: 600,
  }, { timeout: 40000, maxRetries: 1 });
  return { text: res.choices[0]?.message?.content || '', sources: [] };
}

const norm = (s) => String(s || '').toLowerCase();

function mentionsBrand(text) {
  return norm(text).includes(BRAND);
}

// Gemini's grounding URIs are redirect links, so the real domain usually shows
// in the source TITLE — check both.
function citesSite(sources) {
  return (sources || []).some(s => norm(s.uri).includes(SITE_DOMAIN) || norm(s.title).includes(BRAND));
}

function findCompetitors(text, names) {
  const t = norm(text);
  return names.filter(n => n && t.includes(norm(n)));
}

// Live competitor names (preferred) + fallback for a fresh install.
async function competitorNames() {
  const rows = await CompetitorProfile.find({}).select('name domain').lean().catch(() => []);
  const live = rows
    .map(r => r.name || String(r.domain || '').replace(/^www\./, '').split('.')[0])
    .filter(n => n && norm(n) !== BRAND);
  const merged = [...new Set([...live, ...FALLBACK_COMPETITORS])];
  return merged.slice(0, 40);
}

// Start a run and drive it in the background — the request returns immediately
// and the UI polls, same pattern as the Atelier.
async function startRun({ triggeredBy } = {}) {
  if (!geminiReady() && !deepseekReady()) {
    return AiVisibility.create({
      status: 'completed', completedAt: new Date(), triggeredBy: triggeredBy || '',
      note: 'No AI provider configured — set GEMINI_API_KEY (for grounded citations) and/or DEEPSEEK_API_KEY in Railway.',
    });
  }
  const doc = await AiVisibility.create({ status: 'running', triggeredBy: triggeredBy || '' });
  _run(doc._id).catch(err => {
    console.error('[aiVisibility] run failed:', err.message);
    AiVisibility.findByIdAndUpdate(doc._id, { status: 'failed', completedAt: new Date(), note: err.message }).catch(() => {});
  });
  return doc;
}

async function _run(runId) {
  const names = await competitorNames();
  const providers = [];
  if (geminiReady()) providers.push({ key: 'gemini', ask: askGemini });
  if (deepseekReady()) providers.push({ key: 'deepseek', ask: askDeepSeek });

  const results = [];
  const byProvider = {};
  const compCount = {};

  for (const p of providers) {
    byProvider[p.key] = { queries: 0, mentions: 0, citations: 0 };
    for (const prompt of PROMPTS) {
      byProvider[p.key].queries++;
      try {
        const { text, sources } = await p.ask(prompt);
        const mentioned = mentionsBrand(text);
        const cited = citesSite(sources);
        const competitors = findCompetitors(text, names);
        if (mentioned) byProvider[p.key].mentions++;
        if (cited) byProvider[p.key].citations++;
        for (const c of competitors) compCount[c] = (compCount[c] || 0) + 1;
        results.push({
          prompt, provider: p.key, mentioned, cited, competitors,
          sources: sources.slice(0, 6),
          excerpt: String(text).replace(/\s+/g, ' ').trim().slice(0, 300),
        });
      } catch (err) {
        results.push({ prompt, provider: p.key, mentioned: false, cited: false, competitors: [], sources: [], error: String(err.message).slice(0, 160) });
      }
    }
  }

  const queries = results.filter(r => !r.error).length;
  const mentions = results.filter(r => r.mentioned).length;
  const citations = results.filter(r => r.cited).length;
  const competitorShare = Object.entries(compCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  await AiVisibility.findByIdAndUpdate(runId, {
    status: 'completed',
    completedAt: new Date(),
    queries, mentions, citations,
    visibility: queries ? Math.round((mentions / queries) * 100) : 0,
    byProvider, competitorShare, results,
    note: geminiReady() ? '' : 'Set GEMINI_API_KEY for grounded citations (DeepSeek alone measures training recall, not live sources).',
  }).catch(err => console.error('[aiVisibility] save failed:', err.message));
}

module.exports = { startRun, PROMPTS, geminiReady, deepseekReady };
