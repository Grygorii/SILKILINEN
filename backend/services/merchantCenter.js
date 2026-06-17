// Google Merchant Center (Content API for Shopping v2.1) reader.
//
// Pulls live product statuses so the admin dashboard can show the EXACT reason
// any product is disapproved — the data Merchant Center has but our backend
// never saw. Read-only; aggregates item-level issues across the catalogue.
//
// Requires GOOGLE_SERVICE_ACCOUNT_KEY (the robot's key) and MERCHANT_ID in the
// environment, and the robot added as a user in Merchant Center. Until then
// isConfigured() is false and callers skip cleanly.

const { getAccessToken } = require('./googleAuth');

const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content';
const BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';

function isConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.MERCHANT_ID);
}

// Returns:
//   { configured: false }                                  // not set up / auth failed
//   { configured: true, total, approved, pending,
//     disapproved, issues: [{ code, description, detail,
//     servability, documentation, count, exampleProductId }] }
async function getProductIssues({ maxPages = 4, timeoutMs = 8000 } = {}) {
  if (!isConfigured()) return { configured: false };
  const token = await getAccessToken(CONTENT_SCOPE);
  if (!token) return { configured: false };

  const merchantId = process.env.MERCHANT_ID;
  let pageToken;
  let pages = 0;
  let total = 0, approved = 0, pending = 0, disapproved = 0;
  const issueMap = new Map();

  do {
    const url = new URL(`${BASE}/${encodeURIComponent(merchantId)}/productstatuses`);
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let data;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Content API HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
      }
      data = await res.json();
    } finally {
      clearTimeout(t);
    }

    for (const p of data.resources || []) {
      total++;
      // A product has a status PER destination (Free listings, Shopping ads, …),
      // and the API returns it either as `status` or as approved/pending/
      // disapprovedCountries arrays depending on the destination shape. Collect
      // every state across all destinations.
      const states = new Set();
      for (const d of p.destinationStatuses || []) {
        if (d.status) states.add(d.status);
        if ((d.approvedCountries || []).length) states.add('approved');
        if ((d.pendingCountries || []).length) states.add('pending');
        if ((d.disapprovedCountries || []).length) states.add('disapproved');
      }
      // Mirror Merchant Center's headline status: a product counts as APPROVED if
      // it's live for ANY destination (typically Free listings), even when a
      // stricter destination (Shopping ads) disapproved it over an item-level
      // issue. Only count it disapproved when it isn't approved anywhere — that's
      // the difference between "shows in Merchant as Approved" and our old code
      // flagging the whole catalogue as disapproved.
      if (states.has('approved')) approved++;
      else if (states.has('disapproved')) disapproved++;
      else if (states.has('pending')) pending++;
      else approved++; // no destination info — assume servable rather than alarm

      for (const issue of p.itemLevelIssues || []) {
        const key = issue.code || issue.description || 'unknown';
        const existing = issueMap.get(key) || {
          code: issue.code,
          description: issue.description,
          detail: issue.detail,
          servability: issue.servability, // 'disapproved' | 'demoted' | 'unaffected'
          documentation: issue.documentation,
          count: 0,
          exampleProductId: p.productId,
        };
        existing.count++;
        issueMap.set(key, existing);
      }
    }

    pageToken = data.nextPageToken;
    pages++;
  } while (pageToken && pages < maxPages);

  const sev = s => (s === 'disapproved' ? 2 : s === 'demoted' ? 1 : 0);
  const issues = [...issueMap.values()].sort(
    (a, b) => sev(b.servability) - sev(a.servability) || b.count - a.count
  );

  return { configured: true, total, approved, pending, disapproved, issues };
}

module.exports = { isConfigured, getProductIssues };
