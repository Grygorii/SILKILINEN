'use strict';

// Storefront Scout — "study the enemies' websites." Reads a competitor's
// actual storefront HTML and SILKILINEN's own, then reports concrete site /
// UX / conversion improvements to steal. Pure website craft (merchandising,
// trust, copy, navigation, urgency-without-sleaze), distinct from the
// Competitor Scout's strategy/positioning work.

const { getCompetitors } = require('../competitorIntel');
const { assertPublicUrl } = require('../safeUrl');
const SystemState = require('../../models/SystemState');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';
const ROTATE_KEY = 'growthStorefrontRotation';
const OWN_SITE = 'https://www.silkilinen.com';

// Pull the visible text + key structural signals from a page, cheaply. We
// don't render JS — but the hero copy, nav, trust badges, section headings
// and CTA wording in the static HTML are exactly what reveals merchandising
// strategy. Returns a compact digest the model can read, or null on failure.
async function pageDigest(url) {
  try {
    // SSRF guard — competitor.domain is admin-entered free text; never let it
    // resolve to a private/internal/metadata address. Throws → caught → null.
    await assertPublicUrl(url);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SilkilinenBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const pick = (re, n = 1) => [...html.matchAll(re)].slice(0, n).map(m => m[1]);
    const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

    const title = clean((pick(/<title[^>]*>([\s\S]*?)<\/title>/i)[0] || ''));
    const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)[0] || '';
    const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, 3).map(clean).filter(Boolean);
    const h2 = pick(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, 12).map(clean).filter(Boolean);
    // Button / CTA wording reveals the conversion playbook.
    const ctas = [...html.matchAll(/<(?:button|a)[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
      .slice(0, 14).map(m => clean(m[1])).filter(t => t && t.length < 40);

    return {
      url,
      title: title.slice(0, 160),
      metaDescription: clean(metaDesc).slice(0, 220),
      headings: [...new Set([...h1, ...h2])].slice(0, 14),
      ctas: [...new Set(ctas)].slice(0, 12),
    };
  } catch {
    return null;
  }
}

const SYSTEM = `You are a senior DTC e-commerce conversion consultant. You study competitor storefronts and tell a small luxury silk/linen brand (SILKILINEN, www.silkilinen.com) exactly what to copy or improve on its OWN website. You are given compact digests (title, meta description, headings, button/CTA wording) of a competitor's homepage and SILKILINEN's homepage.

Focus on website CRAFT, not strategy: hero clarity, value proposition, trust signals (reviews, guarantees, shipping/returns framing), merchandising and category presentation, product-page persuasion, CTA wording, urgency without sleaze, gifting flows, email capture, navigation. Be concrete — quote what the competitor does and say the exact change SILKILINEN should make. Keep SILKILINEN's quiet-luxury voice (never salesy/urgent hype, never "handmade"/origin claims).

RESPOND ONLY WITH VALID JSON (no markdown):
{
 "competitorDoesWell": ["short, specific things the competitor's site does well"],
 "silkilinenGaps": ["specific things SILKILINEN's site is missing or doing weakly"],
 "improvements": [
   {"change": "the exact change to make on silkilinen.com", "where": "page/area", "why": "the conversion reason", "effort": "low|medium"}
 ]
}
Give 3-5 improvements, sharpest first.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const competitors = (await getCompetitors()).filter(c => c.domain);
  if (!competitors.length) {
    return [{ type: 'info', title: 'Add a competitor with a website to scout their storefront', status: 'info' }];
  }

  // Rotate through competitors that have a domain.
  const rotDoc = await SystemState.findOne({ key: ROTATE_KEY }).lean();
  const idx = (rotDoc && Number.isInteger(rotDoc.value) ? rotDoc.value : 0) % competitors.length;
  const competitor = competitors[idx];
  await SystemState.findOneAndUpdate({ key: ROTATE_KEY }, { value: (idx + 1) % competitors.length }, { upsert: true });

  const [theirs, ours] = await Promise.all([
    pageDigest(`https://${competitor.domain}`),
    pageDigest(OWN_SITE),
  ]);

  if (!theirs) {
    return [{
      type: 'info',
      title: `Couldn't read ${competitor.name}'s site this time`,
      detail: `${competitor.domain} blocked the read or was unreachable. Will retry next run; meanwhile the Competitor Scout still covers their strategy.`,
      status: 'info',
    }];
  }

  const userParts = [
    `COMPETITOR HOMEPAGE — ${competitor.name} (${competitor.domain}):`,
    JSON.stringify(theirs),
    ``,
    `SILKILINEN HOMEPAGE:`,
    ours ? JSON.stringify(ours) : '(could not read our own homepage this run — infer from the brand description)',
    ``,
    `Return the JSON now.`,
  ];

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userParts.join('\n') },
    ],
    temperature: 0.4,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  const a = JSON.parse(content);
  if (!Array.isArray(a.improvements) || !a.improvements.length) {
    throw new Error('Storefront analysis returned no improvements');
  }

  const top = a.improvements.slice(0, 3)
    .map((m, i) => `${i + 1}. ${m.change}${m.where ? ` (${m.where})` : ''}`)
    .join('  ');

  return [{
    type: 'site_improvement',
    title: `Steal from ${competitor.name}'s website`,
    detail: `They do well: ${(a.competitorDoesWell || []).slice(0, 2).join('; ')}. Your fixes: ${top}`,
    href: OWN_SITE,
    status: 'needs_approval',
    meta: { competitor: competitor.name, analysis: a },
  }];
}

module.exports = {
  name: 'storefront',
  label: 'Storefront Scout',
  description: 'Reads a competitor’s website and your own, then lists concrete site, UX and conversion improvements to steal. Press Run to study the next enemy.',
  cadenceHours: 96,
  defaultEnabled: true,
  run,
};
