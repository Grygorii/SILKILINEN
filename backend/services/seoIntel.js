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

    // A Programmable Search Engine defaults to searching ONLY the sites it was
    // created from. Point it at silkilinen.com and every query returns five of
    // our own pages — so the agents read "we hold positions 1 to 5 for
    // everything" and recommend nothing, confidently. That is worse than having
    // no SERP at all, because absence is visible and a wrong answer is not.
    //
    // The whole point of this call is seeing who we are up against, so a result
    // set containing only us is a CONFIGURATION fault, reported as one.
    const ours = results.filter(r => /silkilinen\.com$/i.test(String(r.displayLink || '')));
    if (results.length > 0 && ours.length === results.length) {
      return {
        configured: true,
        results: [],
        error: 'The search engine is restricted to silkilinen.com, so it only ever returns our own pages — there is no competitive picture to read. Turn on "Search the entire web" in Programmable Search Engine (Setup → Basics → Sites to search), or create an engine that searches the whole web.',
        siteRestricted: true,
      };
    }

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
// `canonical(page)` maps a URL Google reports to the page it actually IS today,
// or returns null for a URL that is no longer a page at all. Without it, every
// URL Search Console remembers counts as a separate competitor — and Google
// remembers old URLs for weeks after a redirect.
//
// That produced pure noise after the catalogue was renamed and the categories
// merged. One product reported as three competing pages: its old /product/<slug>
// (301 → the new slug), its current URL, and /shop?category=pillowcases (a
// category merged into `home`, also 301). Nothing was competing with anything —
// it was one product page and one dead URL — but the plan said "consolidate to
// one strong page", which is at best wasted work and at worst an invitation to
// delete or noindex a page that is already correct.
//
// Redirects resolve themselves as Google recrawls, so the honest answer is to
// say nothing rather than to invent a content problem out of a URL change.
function detectCannibalisation(pairs, { minImpressions = 2, canonical = null } = {}) {
  const byQuery = new Map();
  for (const r of pairs || []) {
    if ((r.impressions || 0) < minImpressions) continue;
    // Resolve to today's page. A dropped URL still contributed impressions, but
    // it is not a page anyone can consolidate.
    const key = canonical ? canonical(r.page) : r.page;
    if (!key) continue;
    const list = byQuery.get(r.query) || [];
    // `page` keeps the ORIGINAL URL for display; `key` is what identity means.
    list.push({ page: r.page, key, position: r.position, impressions: r.impressions });
    byQuery.set(r.query, list);
  }
  const out = [];
  for (const [query, pages] of byQuery) {
    // Deduped on the canonical key, so an old URL and its replacement collapse
    // into the single page they are. Keep the best-ranking of the pair for
    // display — that is the one Google currently favours.
    const bestByKey = new Map();
    for (const p of pages) {
      const prev = bestByKey.get(p.key);
      if (!prev || p.position < prev.position) bestByKey.set(p.key, p);
    }
    const distinct = [...bestByKey.values()];
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
