'use strict';

// Outward-looking competitor intelligence — the brain that studies the brands
// SILKILINEN actually competes with instead of staring at its own logs.
//
// The model already knows the luxury silk/sleepwear landscape (Olivia von
// Halle, Lunya, Eberjey, Slip, Quince, LilySilk...) in depth, so the analysis
// never depends on scraping. A best-effort sitemap peek just adds current
// product freshness when a competitor's site allows it; every failure path
// returns null so a blocked fetch can never break a run.

const SystemState = require('../models/SystemState');
const { assertPublicUrl } = require('./safeUrl');

const COMPETITORS_KEY = 'growthCompetitors';

// Real, well-documented competitors across the silk/sleepwear price ladder.
const DEFAULT_COMPETITORS = [
  { name: 'Olivia von Halle', domain: 'oliviavonhalle.com' },
  { name: 'Lunya',           domain: 'lunya.co' },
  { name: 'Eberjey',         domain: 'eberjey.com' },
  { name: 'Slip',            domain: 'slipsilkpillowcase.com' },
  { name: 'Quince',          domain: 'quince.com' },
  { name: 'LilySilk',        domain: 'lilysilk.com' },
];

async function getCompetitors() {
  const doc = await SystemState.findOne({ key: COMPETITORS_KEY }).lean();
  const list = doc && Array.isArray(doc.value) ? doc.value : null;
  return list && list.length ? list : DEFAULT_COMPETITORS;
}

async function setCompetitors(list) {
  const clean = dedupe((Array.isArray(list) ? list : []).map(normaliseCompetitor).filter(c => c.name)).slice(0, 300);
  await SystemState.findOneAndUpdate({ key: COMPETITORS_KEY }, { value: clean }, { upsert: true });
  return clean;
}

function normaliseCompetitor(c) {
  return {
    name: String(c.name || '').trim().slice(0, 80),
    domain: String(c.domain || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').slice(0, 100),
    market: c.market ? String(c.market).trim().slice(0, 40) : undefined,
  };
}

// Dedupe by domain first (the strong key), then by lowercased name.
function dedupe(list) {
  const byDomain = new Set();
  const byName = new Set();
  const out = [];
  for (const c of list) {
    const d = c.domain || '';
    const n = c.name.toLowerCase();
    if (d && byDomain.has(d)) continue;
    if (!d && byName.has(n)) continue;
    if (byName.has(n)) continue;
    if (d) byDomain.add(d);
    byName.add(n);
    out.push(c);
  }
  return out;
}

// Merge freshly-discovered competitors into the stored list, keeping existing
// entries and adding only genuinely new ones. Returns { list, added }.
async function mergeCompetitors(discovered) {
  const existing = await getCompetitors();
  const before = existing.length;
  const merged = dedupe([...existing, ...(discovered || []).map(normaliseCompetitor)]).slice(0, 300);
  await SystemState.findOneAndUpdate({ key: COMPETITORS_KEY }, { value: merged }, { upsert: true });
  return { list: merged, added: merged.length - before };
}

// Best-effort: a sample of current product names from the competitor's
// sitemap (most luxury brands run Shopify → /products/<handle>). Returns null
// on any failure — the analysis falls back to the model's own knowledge.
async function liveProductSample(domain) {
  if (!domain) return null;
  const candidates = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_products_1.xml`,
  ];
  for (const url of candidates) {
    try {
      await assertPublicUrl(url); // SSRF guard
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SilkilinenBot/1.0)' }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const text = await res.text();

      const handles = [...text.matchAll(/\/products\/([a-z0-9-]+)/gi)].map(m => m[1]);
      if (handles.length) {
        return [...new Set(handles)].slice(0, 15).map(h => h.replace(/-/g, ' '));
      }

      // Sitemap index — follow the first products sub-sitemap.
      const sub = text.match(/<loc>\s*([^<]*product[^<]*\.xml)\s*<\/loc>/i);
      if (sub) {
        try {
          await assertPublicUrl(sub[1]); // SSRF guard — the URL came from fetched content
          const r2 = await fetch(sub[1], { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SilkilinenBot/1.0)' }, signal: AbortSignal.timeout(6000) });
          if (r2.ok) {
            const t2 = await r2.text();
            const h2 = [...t2.matchAll(/\/products\/([a-z0-9-]+)/gi)].map(m => m[1]);
            if (h2.length) return [...new Set(h2)].slice(0, 15).map(h => h.replace(/-/g, ' '));
          }
        } catch { /* ignore */ }
      }
    } catch { /* try next candidate */ }
  }
  return null;
}

module.exports = { getCompetitors, setCompetitors, mergeCompetitors, normaliseCompetitor, dedupe, liveProductSample, DEFAULT_COMPETITORS };
