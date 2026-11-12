'use strict';
const { loadEvidence, publicEvidence } = require('./commerceEvidence');
const STAGES = [
  { key: 'sessions', label: 'Visited the site', event: null },
  { key: 'viewedProduct', label: 'Opened a product', event: 'view_item', why: 'Review entry pages and navigation. This is an observed gap, not proof that the homepage caused an exit.', fix: { label: 'Review entry journeys', href: '/admin/journeys' } },
  { key: 'addedToCart', label: 'Added to cart', event: 'add_to_cart', why: 'Review fit, photographs, sizing and delivery clarity as hypotheses, not established causes.', fix: { label: 'Review product journeys', href: '/admin/journeys?stage=view_item' } },
  { key: 'reachedCheckout', label: 'Reached checkout', event: 'begin_checkout', why: 'Review the cart-to-checkout step; a missing event does not identify the reason.', fix: { label: 'Review cart journeys', href: '/admin/journeys?stage=add_to_cart' } },
  { key: 'startedPayment', label: 'Requested payment', event: 'reached_payment', why: 'Check validation and the price summary. This event records the request, not successful Stripe payment creation.', fix: { label: 'Review checkout journeys', href: '/admin/journeys?stage=begin_checkout' } },
  { key: 'purchased', label: 'Paid · linked browsers', event: 'purchase', why: '', fix: null },
];
const MIN_SEGMENT = 30, SHIFT_POINTS = 10;
function stagesFromEvidence(evidence) {
  return STAGES.map((definition, index) => {
    const observed = evidence.stage[definition.key], previous = index ? evidence.stage[STAGES[index - 1].key] : null;
    let progressed = 0;
    if (previous) for (const [sid, times] of previous) {
      const after = observed.get(sid), first = times.reduce((min, at) => Math.min(min, at), Infinity);
      if (after?.some(at => at >= first)) progressed++;
    }
    const incomplete = definition.key === 'purchased' && evidence.summary.unlinkedOrders > 0;
    const enteredFrom = previous ? previous.size : observed.size;
    return { ...definition, count: observed.size, progressed: previous ? progressed : observed.size, enteredFrom,
      lost: incomplete ? null : previous ? enteredFrom - progressed : 0,
      rate: incomplete || !enteredFrom ? null : previous ? Math.round(progressed / enteredFrom * 100) : 100,
      reliability: incomplete ? 'unlinked_orders' : enteredFrom < MIN_SEGMENT ? 'small_sample' : 'observed' };
  });
}
function detectShifts(stages, prevStages) {
  const before = Object.fromEntries(prevStages.map(s => [s.key, s]));
  return stages.slice(1).map(s => {
    const was = before[s.key];
    if (!was || s.rate == null || was.rate == null || s.enteredFrom < MIN_SEGMENT || was.enteredFrom < MIN_SEGMENT) return null;
    const delta = s.rate - was.rate;
    return Math.abs(delta) < SHIFT_POINTS ? null : { key: s.key, label: s.label, rateNow: s.rate, ratePrev: was.rate, delta, direction: delta < 0 ? 'down' : 'up', fix: s.fix };
  }).filter(Boolean).sort((a,b) => a.delta - b.delta);
}
async function getFunnel(days = 14) {
  const now = new Date();
  const [current, previous] = await Promise.all([loadEvidence(days, { now }), loadEvidence(days, { now, offsetDays: days })]);
  const stages = stagesFromEvidence(current), prevStages = stagesFromEvidence(previous), blindSpots = [];
  if (current.summary.unlinkedOrders) blindSpots.push({ key: 'purchased', label: 'Paid attribution', event: 'order_link', note: `${current.summary.orders} purchases exist in the order ledger; ${current.summary.unlinkedOrders} website orders lack a matching browser in this window. Purchase conversion is unknown, not zero.` });
  if (current.quality.productPagesWithoutViewEvent) blindSpots.push({ key: 'viewedProduct', label: 'Product-view coverage', event: 'view_item', note: `${current.quality.productPagesWithoutViewEvent}/${current.quality.productPageBrowsers} product-page browsers lack a view_item event. Product-page visits are included below; tracking gaps or automation may affect comparisons.` });
  if (current.summary.orders && !current.quality.purchaseEvents) blindSpots.push({ key: 'receipt', label: 'Browser purchase events', event: 'purchase', note: 'No browser purchase event was recorded in this window. Paid orders still come from the order ledger, independently of the success-page event.' });
  const gap = data => data.quality.productPagesWithoutViewEvent > data.quality.productPageBrowsers * .2;
  const candidates = gap(current) ? [] : stages.slice(1).filter(s => s.lost > 0 && s.enteredFrom >= MIN_SEGMENT && s.rate !== null);
  const biggestLeak = candidates.sort((a,b) => b.lost - a.lost)[0] || null;
  const shifts = gap(current) || gap(previous) ? [] : detectShifts(stages, prevStages);
  return { days, stages, biggestLeak, diagnosis: null, shifts, biggestShift: shifts[0] || null, blindSpots,
    overallConversion: current.summary.conversionPercent, hasData: current.quality.browsers > 0 || current.summary.orders > 0,
    evidence: publicEvidence(current), methodology: 'Observed browser reach, not a forced sequential funnel. Product pages count as views. Step rates use the same browser IDs in time order; missing earlier steps are not invented. Browser IDs persist across visits.' };
}
module.exports = { getFunnel, stagesFromEvidence, STAGES, detectShifts, MIN_SEGMENT, SHIFT_POINTS };
