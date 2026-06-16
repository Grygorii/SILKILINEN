'use strict';

// Advanced SEO intelligence — the senior-strategist analyses Hermes was missing.
//   • serpAnalysis(query): what's ACTUALLY ranking on Google for a query — the
//     content format/depth Hermes was blind to. Uses the Google Custom Search
//     JSON API (free 100/day). Gated on GOOGLE_CSE_KEY + GOOGLE_CSE_ID; returns
//     { configured:false } until set, so callers degrade to AI reasoning.
//   • detectCannibalisation(pairs): queries where two+ of the site's own pages
//     compete — the classic ranking-suppressor on-page tools never catch.
//
// Everything fails soft (returns empty/unconfigured) so a missing key or a
// blocked network never breaks a Hermes run.

const CSE_KEY = () => process.env.GOOGLE_CSE_KEY || '';
const CSE_ID = () => process.env.GOOGLE_CSE_ID || '';

function serpConfigured() {
  return Boolean(CSE_KEY() && CSE_ID());
}

// Top organic results for a query, with title + snippet (Google's own SERP).
async function serpAnalysis(query, geo = 'ie') {
  if (!serpConfigured()) return { configured: false, results: [] };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(CSE_KEY())}&cx=${encodeURIComponent(CSE_ID())}&num=5&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      // Surface Google's exact reason (e.g. "Requests from referer <empty> are
      // blocked", "API key not valid", "accessNotConfigured") so the health
      // check pinpoints the fix instead of a bare HTTP code.
      let reason = '';
      try {
        const e = await res.json();
        reason = e?.error?.message || e?.error?.errors?.[0]?.message || e?.error?.errors?.[0]?.reason || '';
      } catch { /* body not JSON */ }
      return { configured: true, results: [], error: `HTTP ${res.status}${reason ? ` — ${reason}` : ''}` };
    }
    const data = await res.json();
    const results = (data.items || []).slice(0, 5).map(i => ({
      title: i.title || '',
      snippet: (i.snippet || '').replace(/\s+/g, ' ').trim(),
      link: i.link || '',
      displayLink: i.displayLink || '',
    }));
    return { configured: true, results };
  } catch (err) {
    return { configured: true, results: [], error: err.message };
  } finally {
    clearTimeout(t);
  }
}

// Cannibalisation: queries for which two or more of the site's OWN pages rank
// with real impressions — they split signals and suppress each other. Needs the
// site's own host (GSC_SITE_URL) so we only compare internal pages.
function detectCannibalisation(pairs, { minImpressions = 2 } = {}) {
  const byQuery = new Map();
  for (const r of pairs || []) {
    if ((r.impressions || 0) < minImpressions) continue;
    const list = byQuery.get(r.query) || [];
    list.push({ page: r.page, position: r.position, impressions: r.impressions });
    byQuery.set(r.query, list);
  }
  const out = [];
  for (const [query, pages] of byQuery) {
    const distinct = [...new Map(pages.map(p => [p.page, p])).values()];
    if (distinct.length >= 2) {
      distinct.sort((a, b) => a.position - b.position);
      out.push({ query, pages: distinct.slice(0, 4) });
    }
  }
  // Worst first: more competing pages, then more impressions at stake.
  out.sort((a, b) => b.pages.length - a.pages.length ||
    b.pages.reduce((s, p) => s + p.impressions, 0) - a.pages.reduce((s, p) => s + p.impressions, 0));
  return out.slice(0, 8);
}

module.exports = { serpConfigured, serpAnalysis, detectCannibalisation };
