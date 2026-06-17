'use strict';

// The Atelier's deterministic critics — the craft the eye alone can't measure.
// Each returns { score (1-10), summary, findings[] } and is fail-soft.
//   • Curator   — design-system COHERENCE (a villa uses one tight palette/scale)
//   • Concierge — luxury VOICE (calm, confident; never hype or discount)
//   • Atmosphere— SPEED, the feeling of doors that open instantly (real CWV)

const { fetchReadablePage } = require('./externalData');
const textClient = require('./aiClient');
const TEXT_MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';
const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

// ── Curator: design-system coherence ──────────────────────────────────────────
// The intentional brand palette (from frontend globals.css tokens) + neutrals.
const PALETTE = new Set(['#faf8f4', '#f5f0e8', '#ece4d4', '#e8e2d6', '#6b6358', '#2a2218', '#c4a882', '#ffffff', '#fff', '#000000', '#000']);

async function curate() {
  try {
    const html = await fetch(`${SITE}/`, { signal: AbortSignal.timeout(12000) }).then(r => r.text()).catch(() => '');
    const cssUrls = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/gi)].map(m => m[1]).slice(0, 6);
    let css = '';
    for (const u of cssUrls) {
      const abs = u.startsWith('http') ? u : `${SITE}${u}`;
      css += await fetch(abs, { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => '');
    }
    if (!css) return { score: 0, summary: 'Could not read the stylesheet to judge coherence.', findings: [] };

    const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map(m => m[0].toLowerCase());
    const counts = {};
    for (const h of hexes) counts[h] = (counts[h] || 0) + 1;
    const distinct = Object.keys(counts);
    const offPalette = distinct.filter(h => !PALETTE.has(h));
    // A coherent luxury front-end leans on a tight palette; many ad-hoc colours =
    // dissonance in the walls. Score by how far off-palette colour count drifts.
    const off = offPalette.length;
    const score = Math.max(1, Math.min(10, Math.round(10 - Math.max(0, off - 6) * 0.5)));
    const top = offPalette.sort((a, b) => counts[b] - counts[a]).slice(0, 8);
    return {
      score,
      summary: `${distinct.length} distinct colours in the CSS, ${off} outside the brand palette. A tight palette is what makes a space feel intentional.`,
      findings: off > 6 ? [`Off-palette colours to reconcile to tokens: ${top.join(', ')}`] : ['Palette is tight — close to the brand tokens.'],
    };
  } catch (err) {
    return { score: 0, summary: `Coherence check failed: ${err.message}`, findings: [] };
  }
}

// ── Concierge: luxury voice ───────────────────────────────────────────────────
const HYPE = /\b(amazing|incredible|best ever|stunning|gorgeous|must-have|wow|hurry|limited time|sale|discount|deal|cheap|bargain|% off|don'?t miss|act now|shop now!|buy now!)\b/gi;

async function concierge() {
  try {
    const paths = ['/', '/shop', '/about'];
    let copy = '';
    for (const p of paths) copy += '\n' + (await fetchReadablePage(`${SITE}${p}`, 1800).catch(() => ''));
    if (copy.trim().length < 100) return { score: 0, summary: 'Could not read enough copy to judge voice.', findings: [] };

    // Deterministic tells of un-luxurious voice.
    const bangs = (copy.match(/!/g) || []).length;
    const shouts = (copy.match(/\b[A-Z]{4,}\b/g) || []).filter(w => w !== 'SILKILINEN' && w !== 'OEKO').length;
    const hype = [...new Set((copy.match(HYPE) || []).map(s => s.toLowerCase()))];

    let llm = null;
    try {
      const res = await textClient.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: 'You judge brand VOICE for a quiet-luxury silk house. Luxury voice is calm, confident, spare — never hype, never exclamation, never discount/urgency. Rate 1-10 and name the worst off-voice phrases. JSON only: {"score":1-10,"worst":["phrase",...]}' },
          { role: 'user', content: `Site copy:\n${copy.slice(0, 3500)}` },
        ],
        temperature: 0.2, max_tokens: 300, response_format: { type: 'json_object' },
      }, { timeout: 25000, maxRetries: 1 });
      llm = JSON.parse(res.choices[0]?.message?.content || '{}');
    } catch { /* deterministic-only */ }

    const findings = [];
    if (bangs > 2) findings.push(`${bangs} exclamation marks — luxury speaks calmly, almost never with “!”.`);
    if (shouts > 3) findings.push(`${shouts} all-caps words shouting in the body copy.`);
    if (hype.length) findings.push(`Hype/discount language to remove: ${hype.join(', ')}.`);
    if (Array.isArray(llm?.worst) && llm.worst.length) findings.push(`Off-voice phrases: ${llm.worst.slice(0, 4).join('; ')}.`);
    if (!findings.length) findings.push('Voice reads calm and considered — on brand.');

    // Blend deterministic + LLM.
    const penalty = Math.min(5, bangs * 0.5 + (shouts > 3 ? 1 : 0) + hype.length);
    const detScore = Math.max(1, 10 - penalty);
    const score = llm?.score ? Math.round((detScore + Math.max(1, Math.min(10, Number(llm.score)))) / 2) : Math.round(detScore);
    return { score, summary: 'How the words make a discerning reader feel — calm and confident, or pushy.', findings };
  } catch (err) {
    return { score: 0, summary: `Voice check failed: ${err.message}`, findings: [] };
  }
}

// ── Atmosphere: real Core Web Vitals (speed = the feeling of arriving) ─────────
async function psi(url) {
  const key = process.env.PAGESPEED_API_KEY ? `&key=${process.env.PAGESPEED_API_KEY}` : '';
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${key}`;
  const data = await fetch(api, { signal: AbortSignal.timeout(28000) }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!data?.lighthouseResult) return null;
  const lr = data.lighthouseResult;
  const lcp = lr.audits?.['largest-contentful-paint']?.numericValue;
  const cls = lr.audits?.['cumulative-layout-shift']?.numericValue;
  return {
    url,
    perf: Math.round((lr.categories?.performance?.score || 0) * 100),
    lcpS: lcp ? Math.round(lcp / 100) / 10 : null,
    cls: cls != null ? Math.round(cls * 1000) / 1000 : null,
  };
}

async function atmosphere(paths = ['/', '/shop']) {
  try {
    const results = [];
    for (const p of paths.slice(0, 3)) {
      const r = await psi(`${SITE}${p}`);
      if (r) results.push(r);
    }
    if (!results.length) return { score: 0, summary: 'Could not measure performance (PageSpeed unavailable).', findings: [] };
    const avg = Math.round(results.reduce((s, r) => s + r.perf, 0) / results.length);
    const score = Math.max(1, Math.min(10, Math.round(avg / 10)));
    const findings = results.map(r => `${r.url.replace(SITE, '') || '/'}: ${r.perf}/100${r.lcpS ? `, LCP ${r.lcpS}s` : ''}${r.cls != null ? `, CLS ${r.cls}` : ''}`);
    const slow = results.filter(r => r.lcpS && r.lcpS > 2.5);
    if (slow.length) findings.push(`⚠ Slow first paint (LCP > 2.5s) on: ${slow.map(r => r.url.replace(SITE, '') || '/').join(', ')} — the doors don't open instantly.`);
    return { score, summary: `Mobile performance averages ${avg}/100. Speed is the first thing a discerning visitor feels.`, findings };
  } catch (err) {
    return { score: 0, summary: `Performance check failed: ${err.message}`, findings: [] };
  }
}

module.exports = { curate, concierge, atmosphere };
