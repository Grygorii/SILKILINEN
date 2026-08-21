'use strict';

// Advanced SEO intelligence — the senior-strategist analyses Hermes was missing.
//   • serpAnalysis(query): what's ACTUALLY ranking on Google for a query — the
//     content format/depth Hermes was blind to. Uses the Google Custom Search
//     JSON API (free 100/day).
//   • detectCannibalisation(pairs): queries where two+ of the site's own pages
//     compete — the classic ranking-suppressor on-page tools never catch.
//
// Everything fails soft (returns empty/unconfigured) so a missing key or a
// blocked network never breaks a Hermes run.
//
// ── Why a search engine has to DECLARE its scope ──
//
// A Google Programmable Search Engine searches only the sites it was built
// from, unless it was created with "Search the entire web". Those are two
// completely different instruments wearing one API, and the API does not say
// which one you have.
//
// This shop owns the site-list kind: ~40 curated sites — silkilinen.com plus
// La Perla, Eberjey, Lunya, Olivia von Halle. Excellent competitor intelligence,
// and NOT a results page: it can never return the Wikipedia entry, the magazine
// guide or the marketplace listing that actually occupies page one. Google has
// since stopped offering the whole-web option on new engines for this account —
// the toggle is greyed out and it refuses to delete the last site — so this is
// a permanent state, not a setup step someone forgot.
//
// Fed to Hermes as if it were a SERP, that engine produces confident advice
// about winnable fights that do not exist: five boutique competitors look like
// a soft page one, so "a title rewrite can take this" comes back about a query
// owned by John Lewis and Net-a-Porter. The failure is silent and flattering,
// which is the worst combination a signal can have.
//
// So scope is DECLARED, not guessed: GOOGLE_CSE_SCOPE=web says the engine
// genuinely searches the whole web. The default is `sites` — the conservative
// reading, and the true one here. Anything that wants real rankings gets
// nothing until someone asserts otherwise, because no SERP is a visible gap
// while a wrong SERP is not.

const CSE_KEY = () => process.env.GOOGLE_CSE_KEY || '';
const CSE_ID = () => process.env.GOOGLE_CSE_ID || '';

// `web` only when explicitly declared. Anything else — unset, a typo, someone
// hopefully writing "entire" — means the safe reading: a site list.
function cseScope() {
  return String(process.env.GOOGLE_CSE_SCOPE || '').trim().toLowerCase() === 'web' ? 'web' : 'sites';
}

// Credentials present. NOT the same question as "can this tell us who ranks" —
// see serpConfigured below. Callers that want the curated site list (competitor
// intelligence) want this one.
function cseCredentialled() {
  return Boolean(CSE_KEY() && CSE_ID());
}

// Can this engine answer "who holds page one?" Only a whole-web engine can, so
// a credentialled site-list engine is deliberately NOT configured for SERP work.
function serpConfigured() {
  return cseCredentialled() && cseScope() === 'web';
}

/**
 * The single description of what the search engine is, so the health check, the
 * Connections panel and the agents cannot each invent their own wording (or,
 * worse, their own rule). Four states, never collapsed:
 *   none      — no credentials
 *   sites     — credentials, but a site-list engine: competitor intel, not a SERP
 *   web       — credentials + declared whole-web: real rankings
 */
function serpStatus() {
  if (!cseCredentialled()) {
    return {
      state: 'none',
      scope: cseScope(),
      detail: 'Not connected',
      advice: 'Set GOOGLE_CSE_KEY + GOOGLE_CSE_ID in Railway, then GOOGLE_CSE_SCOPE=web if the engine searches the entire web.',
    };
  }
  if (cseScope() !== 'web') {
    return {
      state: 'sites',
      scope: 'sites',
      detail: 'Connected to a site-list engine — useful competitor intelligence, but not Google\'s page one',
      advice: 'Nothing to fix: Google no longer offers "Search the entire web" on new engines for this account. The agents are told to reason from their own knowledge rather than mistake a competitor list for the real SERP. If you ever do get a whole-web engine, point GOOGLE_CSE_ID at it and set GOOGLE_CSE_SCOPE=web.',
    };
  }
  return { state: 'web', scope: 'web', detail: 'Connected to a whole-web engine', advice: '' };
}

// One raw Custom Search call. Knows nothing about scope — that judgement
// belongs to the two callers below, which mean different things by the same
// list of links.
async function cseQuery(query, geo) {
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
      return { error: `HTTP ${res.status}${reason ? ` — ${reason}` : ''}` };
    }
    const data = await res.json();
    return {
      results: (data.items || []).slice(0, 5).map(i => ({
        title: i.title || '',
        snippet: (i.snippet || '').replace(/\s+/g, ' ').trim(),
        link: i.link || '',
        displayLink: i.displayLink || '',
      })),
    };
  } catch (err) {
    return { error: err.message };
  } finally {
    clearTimeout(t);
  }
}

// Top organic results for a query, with title + snippet (Google's own SERP).
//
// Silent unless the engine is DECLARED whole-web. A site-list engine reaching
// this function used to return five competitor pages that read as page one; it
// now returns nothing at all, and the agents fall back to reasoning from their
// own knowledge — which they do openly, where a flattering fake SERP was
// invisible.
async function serpAnalysis(query, geo = 'ie') {
  if (!serpConfigured()) {
    const st = serpStatus();
    return st.state === 'sites'
      // Credentials work; this engine simply cannot answer the question. Say
      // which, so a caller never reports it as "no API key".
      ? { configured: false, results: [], siteRestricted: true, reason: st.detail }
      : { configured: false, results: [] };
  }

  const { results, error } = await cseQuery(query, geo);
  if (error) return { configured: true, results: [], error };

  // Backstop for an engine declared `web` that is not. The declaration is the
  // rule; this catches the case where it is wrong, and the symptom is
  // unmistakable: a result set consisting only of our own pages. The agents
  // read that as holding positions 1 to 5 and stop recommending work.
  const ours = results.filter(r => /silkilinen\.com$/i.test(String(r.displayLink || '')));
  if (results.length > 0 && ours.length === results.length) {
    return {
      configured: true,
      results: [],
      error: 'Every result was one of our own pages, so there is no competitive picture to read. GOOGLE_CSE_SCOPE says this engine searches the whole web, but it is behaving like a site-list engine — check which engine GOOGLE_CSE_ID points at.',
      siteRestricted: true,
    };
  }

  return { configured: true, results };
}

/**
 * The curated site list for what it actually is: a competitor lens.
 *
 * Same API call, opposite contract — these results are a deliberate set of
 * rivals, never a ranking. Callers must not read position, and the `scope`
 * field is returned so nothing downstream can quietly forget which it holds.
 */
async function curatedSearch(query, geo = 'ie') {
  if (!cseCredentialled()) return { configured: false, results: [] };
  const { results, error } = await cseQuery(query, geo);
  if (error) return { configured: true, scope: cseScope(), results: [], error };
  return { configured: true, scope: cseScope(), results };
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

module.exports = { serpConfigured, serpStatus, cseScope, cseCredentialled, serpAnalysis, curatedSearch, detectCannibalisation };
