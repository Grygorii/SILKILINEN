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

// Per-locale native guidance so the AI writes like a leading luxury house in
// that market (the register + garment terminology real premium sites use) — the
// founder can't verify these languages, so the model must land them natively,
// not literally. `style` is injected into the system prompt.
const SUPPORTED = {
  de: {
    label: 'Deutsch', english: 'German',
    style: 'Write in the restrained, precise register of a premium German fashion house — elegant, never gushing. Address the customer with the formal "Sie". Use the correct terms: Seide (silk), Maulbeerseide (mulberry silk), Leinen (linen), Seidenpyjama, Morgenmantel/Seidenkimono (robe), Nachthemd (nightdress), Dessous/Unterwäsche (lingerie), Slip (briefs). Natural German compound nouns are good; keep "Momme" for silk weight.',
  },
  fr: {
    label: 'Français', english: 'French',
    style: 'Write in the understated, refined register of a French maison — sober elegance, no hyperbole. Use: soie (silk), soie de mûrier (mulberry silk), lin (linen), pyjama de soie, peignoir/robe de chambre (robe), nuisette or chemise de nuit (slip/nightdress), lingerie, culotte (briefs). Keep "Momme".',
  },
  it: {
    label: 'Italiano', english: 'Italian',
    style: 'Write in the warm yet refined register of an Italian luxury brand — elegant and effortless. Use: seta (silk), seta di gelso (mulberry silk), lino (linen), pigiama di seta, vestaglia/kimono di seta (robe), camicia da notte (nightdress), sottoveste (slip), intimo/lingerie, slip (briefs). Keep "Momme".',
  },
  es: {
    label: 'Español', english: 'Spanish',
    style: 'Write for Spain (European Spanish) in the elegant, understated register of a refined boutique. Use: seda (silk), seda de morera (mulberry silk), lino (linen), pijama de seda, bata/kimono de seda (robe), camisón (nightdress), lencería/ropa interior, braguita (briefs). Keep "Momme".',
  },
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
      { role: 'system', content: `You are a native ${SUPPORTED[locale].english} copywriter for SILKILINEN, a quiet-luxury Mulberry-silk & European-linen house. ADAPT each English value into ${SUPPORTED[locale].english} as a native luxury brand would write it — idiomatic, not a literal translation. ${SUPPORTED[locale].style} Keep the calm, refined, understated voice — never hype or exclamation marks. Keep the brand name "SILKILINEN" untranslated, preserve any HTML tags exactly (e.g. <strong>), and keep measurements/units (cm, €). Respond ONLY with a JSON object using the SAME keys, each value adapted.` },
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

// Read-merge for the storefront: overlay stored translations onto doc(s) for a
// locale, IN PLACE. English (or any untranslated field) is the fallback — never
// a blank. A no-op for the default/English path or an unsupported locale, so the
// English response stays byte-identical (same discipline as the EUR path). Works
// on both lean objects (lists) and Mongoose docs (detail) since the merged keys
// (name/description/metaTitle/metaDescription/label) are all schema String paths.
async function localizeDocs(resourceType, docs, locale) {
  if (!SUPPORTED[locale] || docs == null) return docs;
  const arr = Array.isArray(docs) ? docs : [docs];
  const ids = arr.filter(Boolean).map(d => String(d._id));
  if (!ids.length) return docs;
  const rows = await Translation.find({ resourceType, resourceId: { $in: ids }, locale }).lean().catch(() => []);
  if (!rows.length) return docs;
  const byId = Object.fromEntries(rows.map(r => [r.resourceId, r.fields || {}]));
  for (const d of arr) {
    const t = d && byId[String(d._id)];
    if (!t) continue;
    for (const [k, v] of Object.entries(t)) if (typeof v === 'string' && v.trim()) d[k] = v;
  }
  return docs;
}

module.exports = { SUPPORTED, LOCALES, configured, translateFields, translateResource, upsertTranslation, getTranslation, localizeDocs };
