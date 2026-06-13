'use strict';

// Maui — who makes the journey alive, colourful, and impossible not to follow.
// Where Prometheus guards that visitors UNDERSTAND, Maui guards that they FEEL.
// He walks the storefront looking for the flat, generic, boring moments — and
// names where a reveal, a story, a touch of motion or delight would make the
// visitor lean in and follow, without ever breaking quiet-luxury restraint.

const OpenAI = require('openai');
const { gatherExperience } = require('../storefrontExperience');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const SYSTEM = `You are Maui — the showman who makes a journey alive and makes people follow. You guard SILKILINEN's storefront DELIGHT. Walk it and find the flat, generic or boring moments: long copy with no hook, a transactional moment that could be a small joy, a beautiful product shown like a search result, a reveal that lands without drama, a page that doesn't make the visitor lean in.

For each, name the spark: a reveal, a story beat, a tasteful motion, a moment of surprise or warmth that would make the visitor follow — WITHOUT breaking quiet luxury (no casino, no flashing, no urgency hype, no confetti; alive but restrained, like a candle, not a strobe).

Respond ONLY with valid JSON:
{ "moments": [ { "where": "the page/moment", "flat": "why it currently falls flat", "spark": "the specific delightful upgrade to build" } ] }
2-3 moments, the biggest missed chance first. If the journey already sings, return { "moments": [] }.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  const experience = await gatherExperience();

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `The storefront experience:\n\n${experience}\n\nReturn the delight moments as JSON.` }], temperature: 0.7, max_tokens: 800, response_format: { type: 'json_object' } },
      { timeout: 40000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[maui] failed:', err.message);
    return [{ type: 'info', title: 'Maui couldn\'t reach the AI this run — will retry', status: 'info' }];
  }

  const moments = Array.isArray(parsed.moments) ? parsed.moments.slice(0, 3) : [];
  if (!moments.length) {
    return [{ type: 'info', title: 'Maui walked the storefront — the journey already sings', status: 'info' }];
  }
  return moments.map(m => ({
    type: 'experience',
    title: `Delight: ${String(m.where || 'the journey')}`,
    detail: `${m.flat || ''} → Spark: ${m.spark || ''} · Tell Claude to build this.`,
    href: '/admin/growth',
    status: 'needs_approval',
    meta: { where: m.where, flat: m.flat, spark: m.spark, lens: 'delight' },
  }));
}

module.exports = {
  name: 'maui',
  label: 'Maui · Delight',
  description: 'Walks the storefront looking for flat, boring moments and names where a reveal, a story or a touch of motion would make visitors lean in and follow — alive, never gimmicky. Each finding is a "tell Claude to build this".',
  cadenceHours: 168,
  defaultEnabled: true,
  run,
};
