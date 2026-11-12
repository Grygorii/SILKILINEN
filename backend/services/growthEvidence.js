'use strict';
const { loadEvidence, publicEvidence } = require('./commerceEvidence');
const GrowthAction = require('../models/GrowthAction');
const DaVinciComposition = require('../models/DaVinciComposition');
const CEOBrief = require('../models/CEOBrief');
const DAY = 86400000;
function freshness(document, ttlDays, now = new Date()) {
  if (!document?.createdAt) return { status: 'missing', ageDays: null, createdAt: null };
  const ageDays = Math.max(0, Math.floor((now - new Date(document.createdAt)) / DAY));
  return { status: ageDays >= ttlDays ? 'stale' : 'current', ageDays, createdAt: document.createdAt };
}
async function growthEvidence() {
  const [evidence, composition, brief, queue] = await Promise.all([
    loadEvidence(30), DaVinciComposition.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
    CEOBrief.findOne().sort({ createdAt: -1 }).select('createdAt metrics.usedFallback').lean(),
    GrowthAction.aggregate([{ $match: { status: 'needs_approval' } }, { $group: { _id: null, total: { $sum: 1 }, olderThan30Days: { $sum: { $cond: [{ $lt: ['$createdAt', new Date(Date.now() - 30 * DAY)] }, 1, 0] } } } }]),
  ]);
  const { summary: s, quality: q } = evidence, priorities = [];
  if (s.unlinkedOrders) priorities.push({ title: 'Validate acquisition links on the next real sale', evidence: `${s.unlinkedOrders}/${s.websiteOrders} website purchases are unlinked.`, action: 'Use tagged campaign links and check the next order for a saved browser link. Do not guess the source of historical orders.', href: '/admin/orders', measure: 'New orders with browser links / all new website orders' });
  if (q.productPagesWithoutViewEvent) priorities.push({ title: 'Check journey coverage before diagnosing abandonment', evidence: `${q.productPagesWithoutViewEvent}/${q.productPageBrowsers} product-page browsers lack a view_item event.`, action: 'Verify a test journey and compare visits with interaction events. Do not classify visitors as bots solely by city.', href: '/admin/journeys', measure: 'Product-page browsers with view events; same-browser progression into cart and checkout' });
  priorities.push({ title: 'Improve an existing shopping opportunity', evidence: `${s.orders} purchases and €${s.netRevenueEUR.toFixed(2)} net order value in 30 days.`, action: 'Review search landing pages, product sizing and delivery clarity, and the route from useful articles to matching products. Change one thing at a time before drafting more generic content.', href: '/admin/seo', measure: 'Relevant product views, add-to-cart counts and ledger purchases—not impressions alone' });
  return { generatedAt: new Date().toISOString(), ...publicEvidence(evidence), composition: freshness(composition, 90), brief: { ...freshness(brief, 8), fallback: Boolean(brief?.metrics?.usedFallback) }, queue: queue[0] || { total: 0, olderThan30Days: 0 }, priorities: priorities.slice(0, 3) };
}
function fallbackBriefFields(m, ns, competitors = []) {
  if (!m || m.unavailable) throw new Error('Business metrics unavailable; no replacement brief generated');
  const summary = m.commerce?.summary;
  return {
    headline: `${m.orders.last7} ledger purchase(s) this week; attribution and sample size determine what can be learned.`,
    progress: `${ns ? `${ns.current ?? 'Unknown'} of ${ns.target} ${ns.label || 'target'}. ` : 'No target set. '}€${m.revenue.last7} net order value this week.`,
    whatChanged: `${m.humanVisitors.last7} tracked browser IDs this week versus ${m.humanVisitors.prev7} previously. These are not verified people. Location alone does not establish automation.`,
    whatsWorking: `${m.search ? `${m.search.totals.clicks} Google clicks from ${m.search.totals.impressions} impressions. ` : 'Search data is unavailable. '}${summary ? `${summary.linkedOrders}/${summary.websiteOrders} website purchases link to a browser; ${summary.sourceUnresolvedOrders} sources remain unknown or direct/unclassified.` : 'Acquisition attribution is not established.'}`,
    marketRead: `${competitors.length} mapped competitor entries are reference material, not proof of demand or an unoccupied niche.`,
    moves: [{ title: 'Validate measurement and acquisition evidence', agent: 'founder', why: 'Unknown conversion must not be interpreted as zero sales.' }, { title: 'Review an existing shopping landing page', agent: 'hermes', why: 'Use query/page intent and real product interest before drafting another broad article.' }],
    founderActions: ['Review recent orders and their attribution coverage.', 'Choose one product-page or article-to-product improvement; record its date and success measure.'],
    buildIdeas: [], learnings: [],
  };
}
module.exports = { growthEvidence, freshness, fallbackBriefFields };
