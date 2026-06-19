'use strict';

// Competitor scraper — pulls the richest data a brand exposes for free, by ANY
// route (Shopify isn't a cure-all). Cascade per competitor:
//   1. Shopify /products.json   — titles, PRICES, types, publish dates
//   2. WooCommerce Store API    — titles, PRICES, currency, categories
//   3. JSON-LD Product schema   — UNIVERSAL: parse <script ld+json> on a sample
//                                 of product pages (works on any platform)
//   4. Sitemap names            — last resort (names only)
// SSRF-guarded and fail-soft: any failure falls through to the next method.

const { assertPublicUrl } = require('./safeUrl');
const { liveProductSample } = require('./competitorIntel');

const UA = 'Mozilla/5.0 (compatible; SilkilinenBot/1.0; +https://www.silkilinen.com)';
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

async function getJson(url, ms = 7000) {
  await assertPublicUrl(url);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) return null;
  return res.json();
}
async function getText(url, ms = 6000) {
  await assertPublicUrl(url);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) return null;
  return res.text();
}
function priceStats(prices) {
  if (!prices.length) return { priceMin: null, priceMax: null, priceAvg: null };
  const r = n => Math.round(n * 100) / 100;
  return { priceMin: r(Math.min(...prices)), priceMax: r(Math.max(...prices)), priceAvg: r(prices.reduce((s, n) => s + n, 0) / prices.length) };
}

// ── 1. Shopify ───────────────────────────────────────────────────────────────
async function scrapeShopify(domain) {
  const all = [];
  for (let page = 1; page <= 2; page++) {
    let data;
    try { data = await getJson(`https://${domain}/products.json?limit=250&page=${page}`); } catch { break; }
    if (!Array.isArray(data?.products) || !data.products.length) break;
    all.push(...data.products);
    if (data.products.length < 250) break;
  }
  if (!all.length) return null;
  const prices = [], types = new Set(), sampleProducts = [];
  for (const p of all) {
    const vp = (p.variants || []).map(v => num(v.price)).filter(n => n > 0);
    const min = vp.length ? Math.min(...vp) : null;
    if (min != null) prices.push(min);
    if (p.product_type) types.add(String(p.product_type).slice(0, 40));
    if (sampleProducts.length < 14) sampleProducts.push({ title: String(p.title || '').slice(0, 120), price: min, type: p.product_type || undefined, url: `https://${domain}/products/${p.handle}`, publishedAt: p.published_at ? new Date(p.published_at) : undefined });
  }
  const newest = [...all].filter(p => p.published_at).sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 5)
    .map(p => { const vp = (p.variants || []).map(v => num(v.price)).filter(n => n > 0); return { title: String(p.title || '').slice(0, 120), price: vp.length ? Math.min(...vp) : null, url: `https://${domain}/products/${p.handle}`, publishedAt: new Date(p.published_at) }; });
  return { platform: 'shopify', currency: null, productCount: all.length, productCountCapped: all.length >= 500, ...priceStats(prices), productTypes: [...types].slice(0, 12), sampleProducts, newest };
}

// ── 2. WooCommerce Store API ──────────────────────────────────────────────────
async function scrapeWoo(domain) {
  let data;
  try { data = await getJson(`https://${domain}/wp-json/wc/store/products?per_page=100`); } catch { return null; }
  if (!Array.isArray(data) || !data.length) return null;
  const prices = [], types = new Set(), sampleProducts = [];
  let currency = null;
  for (const p of data) {
    const minor = p.prices?.currency_minor_unit ?? 2;
    const price = p.prices?.price != null ? num(p.prices.price) / Math.pow(10, minor) : null;
    if (price > 0) prices.push(price);
    currency = currency || p.prices?.currency_code || null;
    (p.categories || []).forEach(c => c.name && types.add(String(c.name).slice(0, 40)));
    if (sampleProducts.length < 14) sampleProducts.push({ title: String(p.name || '').slice(0, 120), price, type: p.categories?.[0]?.name, url: p.permalink });
  }
  return { platform: 'woocommerce', currency, productCount: data.length, productCountCapped: data.length >= 100, ...priceStats(prices), productTypes: [...types].slice(0, 12), sampleProducts, newest: [] };
}

// ── 3. JSON-LD (universal) ────────────────────────────────────────────────────
// Pull candidate product URLs from the sitemap, fetch a handful, and read the
// Product schema (name + offers.price) most sites embed for SEO.
async function productUrlsFromSitemap(domain) {
  let text;
  for (const u of [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`, `https://${domain}/product-sitemap.xml`]) {
    try { text = await getText(u); if (text) break; } catch { /* next */ }
  }
  if (!text) return [];
  let locs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
  // If it's a sitemap index, follow the first product-ish sub-sitemap.
  if (locs.some(l => /\.xml/i.test(l)) && !locs.some(l => /\/product/i.test(l))) {
    const sub = locs.find(l => /product|shop|catalog/i.test(l)) || locs.find(l => /\.xml/i.test(l));
    if (sub) { try { const t2 = await getText(sub); if (t2) locs = [...t2.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]); } catch { /* ignore */ } }
  }
  const products = locs.filter(l => /\/(product|products|shop|p)\//i.test(l));
  return (products.length ? products : locs).filter(l => /^https?:\/\//.test(l)).slice(0, 10);
}
function extractProductsFromLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let json;
    try { json = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = Array.isArray(json) ? json : (json['@graph'] && Array.isArray(json['@graph']) ? json['@graph'] : [json]);
    for (const n of nodes) {
      const t = n && n['@type'];
      const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
      if (!isProduct) continue;
      const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
      const price = num(offer?.price ?? offer?.lowPrice ?? offer?.highPrice);
      if (n.name && price > 0) out.push({ name: String(n.name).slice(0, 120), price, currency: offer?.priceCurrency || null });
    }
  }
  return out;
}
async function scrapeJsonLd(domain) {
  const urls = await productUrlsFromSitemap(domain).catch(() => []);
  if (!urls.length) return null;
  const prices = [], sampleProducts = [];
  let currency = null;
  for (const u of urls.slice(0, 8)) {
    let html;
    try { html = await getText(u); } catch { continue; }
    if (!html) continue;
    for (const pr of extractProductsFromLd(html)) {
      prices.push(pr.price);
      currency = currency || pr.currency;
      if (sampleProducts.length < 14) sampleProducts.push({ title: pr.name, price: pr.price, url: u });
    }
  }
  if (!sampleProducts.length) return null;
  return { platform: 'jsonld', currency, productCount: sampleProducts.length, ...priceStats(prices), productTypes: [], sampleProducts, newest: [] };
}

// Build a full profile for one competitor, trying every method in turn.
async function scrapeCompetitor({ name, domain }) {
  const base = { name, domain, lastScrapedAt: new Date(), lastError: null };
  if (!domain) return { ...base, platform: 'unknown', lastError: 'no domain' };
  for (const method of [scrapeShopify, scrapeWoo, scrapeJsonLd]) {
    try { const r = await method(domain); if (r) return { ...base, ...r }; } catch { /* next method */ }
  }
  try {
    const names = await liveProductSample(domain);
    if (names?.length) return { ...base, platform: 'other', productCount: names.length, sampleProducts: names.map(t => ({ title: t })) };
  } catch { /* nothing */ }
  return { ...base, platform: 'unknown', lastError: 'no public product data found' };
}

module.exports = { scrapeShopify, scrapeWoo, scrapeJsonLd, scrapeCompetitor };
