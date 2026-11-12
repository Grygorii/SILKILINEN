'use strict';
// Orders remain the financial source of truth. All values here are EUR, not display currency.
const PURCHASE_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'partially_refunded', 'refunded', 'returned'];
const isPurchase = order => PURCHASE_STATUSES.includes(order.status);
const cents = n => Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n) * 100)) : 0;
function netOrderSpend(order) {
  if (!isPurchase(order) || order.status === 'refunded') return 0;
  return Math.max(0, cents(order.total) - Math.max(cents(order.refundedAmount), cents(order.costs?.refundedAmount))) / 100;
}
function customerOrderStats(orders) {
  const purchases = orders.filter(isPurchase).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return {
    orderCount: purchases.length,
    totalSpend: purchases.reduce((sum, order) => sum + cents(netOrderSpend(order)), 0) / 100,
    firstOrderAt: purchases[0]?.createdAt || null,
    lastOrderAt: purchases.at(-1)?.createdAt || null,
  };
}
module.exports = { PURCHASE_STATUSES, isPurchase, netOrderSpend, customerOrderStats };
