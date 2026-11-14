'use strict';
const Visit = require('../models/Visit');
const Event = require('../models/Event');
const Order = require('../models/Order');
const { PURCHASE_STATUSES, netOrderSpend } = require('../utils/customerOrderStats');
const DAY = 86400000, MAX_RECORDS = 50000, CACHE_MS = 60000;
const cache = new Map();
const STAGE_KEYS = ['sessions', 'viewedProduct', 'addedToCart', 'reachedCheckout', 'startedPayment', 'purchased'];
const EVENT_STAGE = { view_item: 'viewedProduct', add_to_cart: 'addedToCart', begin_checkout: 'reachedCheckout', reached_payment: 'startedPayment' };
const LABELS = { direct: 'Direct / unclassified', google: 'Google', instagram: 'Instagram', facebook: 'Facebook', pinterest: 'Pinterest', tiktok: 'TikTok', twitter: 'Twitter / X', referral: 'Other referral', unknown: 'Unknown', manual: 'Manual / offline' };
const millis = value => new Date(value).getTime();
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const pct = (n, d) => d ? Math.round(n / d * 1000) / 10 : null;
function sourceName(value) {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === '(direct)' || source === 'none' || /^(www\.)?silkilinen\.com$/.test(source)) return 'direct';
  return ({ 'google.com': 'google', 'facebook.com': 'facebook', 'instagram.com': 'instagram', 'pinterest.com': 'pinterest', 't.co': 'twitter', 'x.com': 'twitter' })[source] || source;
}
const displayLabel = source => LABELS[source] || source.charAt(0).toUpperCase() + source.slice(1);
// Read-only. Browser IDs persist across visits; they are NOT timed sessions or people.
// Never recover a buyer identity/source using an IP, city, timing or similar order value.
function buildEvidence({ visits = [], events = [], orders = [], since, until }) {
  const start = millis(since), end = millis(until);
  const inWindow = row => millis(row.createdAt) >= start && millis(row.createdAt) < end;
  const v = visits.filter(inWindow).filter(row => validId(row.sessionId)).sort((a,b) => millis(a.createdAt) - millis(b.createdAt));
  const e = events.filter(inWindow).filter(row => validId(row.sessionId));
  const paid = orders.filter(inWindow).filter(row => PURCHASE_STATUSES.includes(row.status));
  const browsers = new Map(), stage = Object.fromEntries(STAGE_KEYS.map(key => [key, new Map()]));
  const eventViewIds = new Set(), pageViewIds = new Set(), interactionIds = new Set();
  const add = (key, sid, at) => { const values = stage[key].get(sid) || []; values.push(millis(at)); stage[key].set(sid, values); };
  for (const row of v) {
    if (!browsers.has(row.sessionId)) browsers.set(row.sessionId, { source: sourceName(row.source), device: row.device || 'unknown', firstAt: millis(row.createdAt), country: row.country, city: row.city });
    add('sessions', row.sessionId, row.createdAt);
    if (row.page === 'product' || String(row.page || '').startsWith('/product/') || row.productId) { pageViewIds.add(row.sessionId); add('viewedProduct', row.sessionId, row.createdAt); }
  }
  for (const row of e) {
    // Funnel stages are explicitly tracked browser IDs. Keep orphan events in
    // coverage diagnostics, but never let them become a customer journey.
    if (!browsers.has(row.sessionId)) continue;
    if (EVENT_STAGE[row.type]) add(EVENT_STAGE[row.type], row.sessionId, row.createdAt);
    if (row.type === 'view_item') eventViewIds.add(row.sessionId);
    if (['card_click', 'add_to_cart', 'begin_checkout', 'reached_payment', 'search', 'wishlist_toggle'].includes(row.type)) interactionIds.add(row.sessionId);
  }
  const rows = new Map();
  const sourceRow = source => {
    if (!rows.has(source)) rows.set(source, { source, displayLabel: displayLabel(source), visitors: 0, buyerIds: new Set(), attributedOrders: 0, revenue: 0 });
    return rows.get(source);
  };
  for (const browser of browsers.values()) sourceRow(browser.source).visitors++;
  let linkedOrders = 0, sourceKnownOrders = 0, manualOrders = 0;
  const attributionOrders = paid.map(order => {
    const sid = validId(order.browserSessionId) ? order.browserSessionId : null, browser = sid ? browsers.get(sid) : null;
    const explicit = order.utm?.source || order.attribution?.source, recorded = sourceName(explicit);
    const manual = recorded === 'manual' || order.attribution?.medium === 'admin';
    const linked = !manual && Boolean(browser && browser.firstAt <= millis(order.createdAt));
    let source = 'unknown', basis = 'missing_link';
    if (manual) { source = 'manual'; basis = 'manual_order'; manualOrders++; }
    else if (linked) { source = browser.source; basis = 'first_observed_browser_source'; linkedOrders++; add('purchased', sid, order.createdAt); }
    else if (explicit && !['direct', 'unknown'].includes(recorded)) { source = recorded; basis = 'recorded_order_source'; }
    else if (sid) basis = 'browser_not_observed_in_window';
    if (!['unknown', 'direct', 'manual'].includes(source)) sourceKnownOrders++;
    const row = sourceRow(source); row.attributedOrders++; row.revenue += Math.round(netOrderSpend(order) * 100);
    if (linked) row.buyerIds.add(sid);
    rows.set(source, row);
    return { id: String(order._id), orderNumber: order.orderNumber || '', createdAt: order.createdAt, status: order.status, totalEUR: netOrderSpend(order), source, sourceLabel: displayLabel(source), basis, linked, linkTo: `/admin/orders/${order._id}` };
  });
  const websiteOrders = paid.length - manualOrders, unlinkedOrders = websiteOrders - linkedOrders;
  const sourceRows = [...rows.values()].map(row => ({
    source: row.source, displayLabel: row.displayLabel, visitors: row.visitors, buyers: row.buyerIds.size,
    attributedOrders: row.attributedOrders, revenue: row.revenue, percentOfTraffic: row.visitors ? pct(row.visitors, browsers.size) : null,
    conversionPercent: unlinkedOrders === 0 && row.visitors >= 20 ? pct(row.buyerIds.size, row.visitors) : null,
    observedLinkedRate: pct(row.buyerIds.size, row.visitors),
  })).sort((a,b) => b.visitors - a.visitors || b.attributedOrders - a.attributedOrders);
  const quality = {
    unit: 'tracked browser IDs', browsers: browsers.size, trafficVerifiedHuman: false,
    withInteraction: [...interactionIds].filter(id => browsers.has(id)).length,
    productPageBrowsers: pageViewIds.size, productEventBrowsers: eventViewIds.size,
    productPagesWithoutViewEvent: [...pageViewIds].filter(id => !eventViewIds.has(id)).length,
    eventBrowsersWithoutVisit: new Set(e.filter(row => !browsers.has(row.sessionId)).map(row => row.sessionId)).size,
    purchaseEvents: new Set(e.filter(row => row.type === 'purchase').map(row => row.sessionId)).size,
    warning: 'Browser IDs persist across visits. Automated visits and missing events may remain; geography alone does not identify bots.',
  };
  const summary = {
    orders: paid.length, websiteOrders, manualOrders, linkedOrders, unlinkedOrders, sourceKnownOrders,
    sourceUnresolvedOrders: websiteOrders - sourceKnownOrders,
    netRevenueEUR: paid.reduce((sum, order) => sum + Math.round(netOrderSpend(order) * 100), 0) / 100,
    linkCoveragePercent: pct(linkedOrders, websiteOrders),
    conversionPercent: unlinkedOrders === 0 && browsers.size >= 20 ? pct(stage.purchased.size, browsers.size) : null,
  };
  return { since: new Date(since).toISOString(), until: new Date(until).toISOString(), summary, quality, sources: sourceRows, orders: attributionOrders, stage, browsers };
}
async function loadEvidence(days = 30, { offsetDays = 0, now = new Date(), fresh = false } = {}) {
  days = Math.min(90, Math.max(1, Math.floor(Number(days) || 30)));
  offsetDays = Math.min(90, Math.max(0, Math.floor(Number(offsetDays) || 0)));
  const key = `${days}:${offsetDays}`, hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const until = new Date(now.getTime() - offsetDays * DAY), since = new Date(until.getTime() - days * DAY), range = { $gte: since, $lt: until };
  const [visits, events, orders] = await Promise.all([
    Visit.find({ createdAt: range }).select('sessionId page productId source device country city createdAt').sort({ createdAt: 1 }).limit(MAX_RECORDS + 1).maxTimeMS(10000).lean(),
    Event.find({ createdAt: range, type: { $in: [...Object.keys(EVENT_STAGE), 'purchase', 'card_click', 'search', 'wishlist_toggle'] } }).select('sessionId type productId source device createdAt').limit(MAX_RECORDS + 1).maxTimeMS(10000).lean(),
    Order.find({ createdAt: range, status: { $in: PURCHASE_STATUSES } }).select('_id orderNumber status total refundedAmount costs.refundedAmount createdAt browserSessionId attribution.source attribution.medium utm.source').sort({ createdAt: -1 }).limit(MAX_RECORDS + 1).maxTimeMS(10000).lean(),
  ]);
  if ([visits, events, orders].some(items => items.length > MAX_RECORDS)) throw new Error('Reporting window exceeds the safe limit; use a shorter range');
  const value = buildEvidence({ visits, events, orders, since, until });
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value }); return value;
}
function clearEvidenceCache() {
  cache.clear();
}
function publicEvidence(evidence) {
  const { stage, browsers, ...plain } = evidence;
  return { ...plain, orders: plain.orders.slice(0, 50), orderListTruncated: plain.orders.length > 50 };
}
function evidencePrompt({ since, until, summary: s, quality: q }) {
  return `COMMERCE EVIDENCE (${since} to ${until}): ${s.orders} ledger purchases; EUR ${s.netRevenueEUR} net order value. ${s.linkedOrders}/${s.websiteOrders} website orders link to a browser in this window; ${s.sourceUnresolvedOrders} sources are unknown or direct/unclassified. ${q.browsers} tracked browser IDs, NOT verified people or timed sessions. ${q.productPagesWithoutViewEvent}/${q.productPageBrowsers} product-page browsers lack a view_item event. Conversion is ${s.conversionPercent === null ? 'UNKNOWN; do not say 0%' : s.conversionPercent + '% observed linked-browser rate'}. Do not infer a buyer source from timing, geography or default direct. Missing events are not proof of abandonment; small samples do not establish a cause.`;
}
module.exports = { buildEvidence, loadEvidence, clearEvidenceCache, publicEvidence, evidencePrompt, STAGE_KEYS, sourceName, displayLabel };
