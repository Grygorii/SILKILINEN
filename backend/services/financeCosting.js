'use strict';

// Finance keeps the cost captured at checkout whenever it exists.  Older
// orders made before costing was entered have no snapshot, so reports may use
// the current product costing for those missing values without rewriting a
// historical figure that was already recorded.
const COST_COMPONENTS = ['materialCost', 'laborCost', 'packagingCost'];

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateCostingInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Costing details are required.' };
  }

  const costing = {};
  for (const field of COST_COMPONENTS) {
    const raw = input[field];
    const value = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: `${field} must be a non-negative number.` };
    }
    costing[field] = roundMoney(value);
  }

  if (input.notes !== undefined && typeof input.notes !== 'string') {
    return { ok: false, error: 'Costing notes must be text.' };
  }
  const notes = String(input.notes || '').trim();
  if (notes.length > 1000) {
    return { ok: false, error: 'Costing notes must be 1,000 characters or fewer.' };
  }

  return {
    ok: true,
    costing: {
      ...costing,
      totalUnitCost: roundMoney(costing.materialCost + costing.laborCost + costing.packagingCost),
      notes,
    },
  };
}

function quantityOf(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function currentProductIdsForMissingCogs(orders) {
  const ids = new Set();
  for (const order of orders || []) {
    if (Number.isFinite(order?.costs?.cogs)) continue;
    for (const item of order?.items || []) {
      if (item?.bundleId) {
        for (const child of item.includedProducts || []) {
          if (child?.productId) ids.add(String(child.productId));
        }
      } else if (item?.productId) {
        ids.add(String(item.productId));
      }
    }
  }
  return [...ids];
}

function costForProduct(productId, costByProductId) {
  const cost = costByProductId.get(String(productId));
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
}

function currentCogsForOrder(order, costByProductId) {
  const items = order?.items || [];
  if (!items.length) return null;

  let total = 0;
  for (const item of items) {
    const lineQuantity = quantityOf(item.quantity);
    if (item?.bundleId) {
      const children = item.includedProducts || [];
      if (!children.length) return null;
      let bundleUnitCost = 0;
      for (const child of children) {
        const childCost = costForProduct(child?.productId, costByProductId);
        if (childCost === null) return null;
        bundleUnitCost += childCost * quantityOf(child.quantity);
      }
      total += bundleUnitCost * lineQuantity;
    } else {
      const unitCost = costForProduct(item?.productId, costByProductId);
      if (unitCost === null) return null;
      total += unitCost * lineQuantity;
    }
  }
  return roundMoney(total);
}

function withResolvedMissingCogs(orders, costByProductId) {
  return (orders || []).map(order => {
    if (Number.isFinite(order?.costs?.cogs)) return order;
    const cogs = currentCogsForOrder(order, costByProductId);
    if (cogs === null) return order;
    return { ...order, costs: { ...(order.costs || {}), cogs } };
  });
}

module.exports = {
  validateCostingInput,
  currentProductIdsForMissingCogs,
  currentCogsForOrder,
  withResolvedMissingCogs,
};
