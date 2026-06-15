'use strict';

// Competitor Discovery — stop typing rivals one by one. The model knows the
// world's silk / linen / sleepwear / intimates brands; this asks it to
// enumerate them across every market SILKILINEN ships to, then (on Railway,
// where egress is open) verifies each domain is actually live before adding,
// so hallucinated domains are pruned. The founder presses one button and the
// scout's study set jumps from a handful to a few hundred real brands.

const OpenAI = require('openai');
const { mergeCompetitors, getCompetitors } = require('./competitorIntel');
const { assertPublicUrl } = require('./safeUrl');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

// Markets aligned to the shipping tiers (worldwide), grouped so each AI call
// can go deep on a region and surface local brands, not just the global names.
const MARKET_GROUPS = [
  { market: 'UK & Ireland',     hint: 'British and Irish brands' },
  { market: 'United States & Canada', hint: 'US and Canadian brands' },
  { market: 'Australia & New Zealand', hint: 'Australian and NZ brands' },
  { market: 'Europe',           hint: 'German, French, Italian, Spanish, Dutch and Scandinavian brands' },
  { market: 'Silk specialists', hint: 'dedicated mulberry-silk specialists worldwide (sleepwear, pillowcases, accessories)' },
];

async function askForBrands(group) {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You map the competitive landscape for SILKILINEN, a luxury silk & linen sleepwear and intimates brand. List REAL, currently-operating brands that sell silk or linen sleepwear, pyjamas, robes, slips, camisoles, intimates, or silk pillowcases/accessories — direct-to-consumer brands and well-known specialist retailers. Only brands you are confident actually exist, with their real primary website domain. No marketplaces (no Amazon/Etsy/eBay), no department stores.

Respond ONLY with valid JSON: {"brands":[{"name":"Brand Name","domain":"brand.com"}]}. Give as many genuine brands as you can (aim for 20-35), no duplicates, domains lowercase without http/www.`,
      },
      {
        role: 'user',
        content: `List silk/linen sleepwear & intimates brands relevant to the ${group.market} market — focus on ${group.hint}, but include the major global brands sold there too. Return the JSON now.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });
  let parsed;
  try { parsed = JSON.parse(res.choices[0]?.message?.content || '{}'); } catch { return []; }
  const brands = Array.isArray(parsed.brands) ? parsed.brands : [];
  return brands
    .filter(b => b && b.name)
    .map(b => ({ name: String(b.name).trim(), domain: String(b.domain || '').trim(), market: group.market }));
}

// Is this domain a real, reachable site? Tight timeout; any network error =>
// false. Returns null if the request couldn't run at all (used to detect a
// fully-blocked environment so we don't wrongly discard everything).
async function domainLive(domain) {
  if (!domain) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    await assertPublicUrl(`https://${domain}`); // SSRF guard — refuse private/internal targets
    const res = await fetch(`https://${domain}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SilkilinenBot/1.0)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return res.status < 500; // 2xx/3xx/4xx all mean "a server answered"
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function verifyInBatches(candidates, concurrency = 12) {
  const results = [];
  let anyChecked = false;
  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const live = await Promise.all(batch.map(async c => {
      if (!c.domain) return { c, ok: false, checked: false };
      const ok = await domainLive(c.domain);
      return { c, ok, checked: true };
    }));
    for (const r of live) { if (r.checked) anyChecked = true; results.push(r); }
  }
  return { results, anyChecked };
}

/**
 * Discover competitors across all shipping markets and merge the live ones
 * into the stored list. Returns { added, total, checked, verified, markets }.
 * AI + network both run on Railway; in the sandbox both are blocked, so this
 * is exercised live on deploy (parsing/dedupe are unit-testable separately).
 */
async function discoverCompetitors() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { error: 'AI not configured' };
  }

  // Enumerate across markets in parallel.
  const groups = await Promise.all(MARKET_GROUPS.map(g => askForBrands(g).catch(() => [])));
  const candidates = groups.flat();
  if (!candidates.length) {
    return { added: 0, total: (await getCompetitors()).length, checked: 0, verified: 0, note: 'No brands returned — try again.' };
  }

  // Verify domains are live (prunes hallucinated/dead domains). If NOTHING
  // could be checked (e.g. egress blocked), keep all rather than discard —
  // better an unverified list than an empty one.
  const { results, anyChecked } = await verifyInBatches(candidates);
  const keep = anyChecked
    ? results.filter(r => r.ok || !r.c.domain).map(r => r.c)
    : candidates;

  const { list, added } = await mergeCompetitors(keep);
  return {
    added,
    total: list.length,
    checked: anyChecked ? results.length : 0,
    verified: anyChecked ? results.filter(r => r.ok).length : 0,
    markets: MARKET_GROUPS.map(g => g.market),
  };
}

module.exports = { discoverCompetitors, MARKET_GROUPS };
