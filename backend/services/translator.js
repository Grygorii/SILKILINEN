'use strict';

// The translation engine — SILKILINEN's "Translate & Adapt". Uses the house AI
// (DeepSeek) to translate content fields into the supported locales in the
// brand's quiet-luxury voice (not literal/robotic), and upserts them into the
// Translation store. A re-run skips locales that already have a translation and
// NEVER overwrites a founder's manual edit. Inert (configured()=false) without
// DEEPSEEK_API_KEY.

const client = require('./aiClient');
const Translation = require('../models/Translation');

const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const SUPPORTED = {
  de: { label: 'Deutsch', english: 'German' },
  fr: { label: 'Français', english: 'French' },
  it: { label: 'Italiano', english: 'Italian' },
  es: { label: 'Español', english: 'Spanish' },
};
const LOCALES = Object.keys(SUPPORTED);

function configured() { return Boolean(process.env.DEEPSEEK_API_KEY); }

// Translate a { field: englishText } object into one locale. Returns a new
// object with the SAME keys, values translated. Preserves brand name, HTML tags,
// measurements. Only non-empty source fields are sent.
async function translateFields(fields, locale) {
  const src = Object.fromEntries(Object.entries(fields || {}).filter(([, v]) => v && String(v).trim()));
  if (!Object.keys(src).length) return {};
  if (!SUPPORTED[locale]) throw new Error(`Unsupported locale: ${locale}`);

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `You translate copy for SILKILINEN, a quiet-luxury Mulberry-silk & European-linen house. Translate each English value into ${SUPPORTED[locale].english}. Keep the calm, refined, understated brand voice — never literal or robotic, never add hype or exclamation marks. Keep the brand name "SILKILINEN" untranslated, preserve any HTML tags exactly (e.g. <strong>), and keep measurements/units (momme, cm, €). Respond ONLY with a JSON object using the SAME keys, each value translated.` },
      { role: 'user', content: JSON.stringify(src) },
    ],
    temperature: 0.3, max_tokens: 1600, response_format: { type: 'json_object' },
  }, { timeout: 45000, maxRetries: 1 });

  const out = JSON.parse(res.choices[0]?.message?.content || '{}');
  const clean = {};
  for (const k of Object.keys(src)) if (typeof out[k] === 'string' && out[k].trim()) clean[k] = out[k];
  return clean;
}

async function upsertTranslation(resourceType, resourceId, locale, fields, source = 'ai') {
  return Translation.findOneAndUpdate(
    { resourceType, resourceId: String(resourceId), locale },
    { $set: { fields: fields || {}, source } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// Translate one resource into the given locales. Skips a locale that already has
// a translation (any source) unless `force`; a manual translation is NEVER
// auto-overwritten even with force. Returns { locale: 'translated'|'exists'|'kept-manual'|'error:…' }.
async function translateResource(resourceType, resourceId, fields, { locales = LOCALES, force = false } = {}) {
  const results = {};
  for (const locale of locales) {
    const existing = await Translation.findOne({ resourceType, resourceId: String(resourceId), locale }).lean().catch(() => null);
    if (existing?.source === 'manual') { results[locale] = 'kept-manual'; continue; }
    if (!force && existing && Object.keys(existing.fields || {}).length) { results[locale] = 'exists'; continue; }
    try {
      const translated = await translateFields(fields, locale);
      if (!Object.keys(translated).length) { results[locale] = 'empty'; continue; }
      await upsertTranslation(resourceType, resourceId, locale, translated, 'ai');
      results[locale] = 'translated';
    } catch (err) { results[locale] = 'error:' + String(err.message).slice(0, 50); }
  }
  return results;
}

// Read a resource's translation for one locale (render-time). Returns the fields
// object, or null if not translated (caller falls back to the English source).
async function getTranslation(resourceType, resourceId, locale) {
  if (!SUPPORTED[locale]) return null;
  const doc = await Translation.findOne({ resourceType, resourceId: String(resourceId), locale }).lean().catch(() => null);
  return doc?.fields && Object.keys(doc.fields).length ? doc.fields : null;
}

module.exports = { SUPPORTED, LOCALES, configured, translateFields, translateResource, upsertTranslation, getTranslation };
