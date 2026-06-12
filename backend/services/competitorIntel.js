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
  const clean = (Array.isArray(list) ? list : [])
    .map(c => ({
      name: String(c.name || '').trim().slice(0, 60),
      domain: String(c.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 100),
    }))
    .filter(c => c.name)
    .slice(0, 12);
  await SystemState.findOneAndUpdate({ key: COMPETITORS_KEY }, { value: clean }, { upsert: true });
  return clean;
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

module.exports = { getCompetitors, setCompetitors, liveProductSample, DEFAULT_COMPETITORS };
