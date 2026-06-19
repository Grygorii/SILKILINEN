'use strict';

// GROUND-TRUTH AUDITOR — the referee that doubts everyone, including the Chief.
//
// Deterministic on purpose: it reads the same database the agents claim about
// and checks their words against it with plain rules, so it can't hallucinate
// the check the way a second LLM could. It catches the dangerous, high-confidence
// falsehoods (an empty catalogue while the shop is stocked; "first revenue" while
// there are no real orders) and hands them back as findings. Reusable by any
// agent — the Chief brief runs it before publishing.

const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');

const PAID = ['paid', 'shipped', 'delivered'];

// The authoritative facts. Everything an agent might over-claim about.
async function gatherFacts() {
  const [activeProducts, priceAgg, paidOrders, categories] = await Promise.all([
    Product.countDocuments({ status: { $in: ['active', 'sold_out'] } }),
    Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out'] }, price: { $gt: 0 } } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
    Order.countDocuments({ status: { $in: PAID } }),
    Category.find({ status: 'active' }).select('label').lean().catch(() => []),
  ]);
  const priceFloor = Math.round((priceAgg[0]?.min || 0) * 100) / 100;
  const priceCeiling = Math.round((priceAgg[0]?.max || 0) * 100) / 100;
  // A "real" order is paid AND at/above the cheapest product — below that is a
  // test/refund/data anomaly, not a sale.
  const realOrders = priceFloor > 0
    ? await Order.countDocuments({ status: { $in: PAID }, total: { $gte: priceFloor } })
    : 0;
  return {
    activeProducts, priceFloor, priceCeiling,
    paidOrders, realOrders,
    categories: categories.map(c => c.label).filter(Boolean),
  };
}

// Each check looks for a claim pattern the facts contradict. Conservative
// patterns — only fire on clear, catalogue/revenue-specific language so a real
// statement isn't mislabelled.
function audit(text, facts) {
  const t = String(text || '').toLowerCase();
  const findings = [];

  if (facts.activeProducts > 0 &&
      /(no products|without products|empty catalog(?:ue)?|catalog(?:ue)? with no products|no products listed|store has no products|nothing to sell|no catalog(?:ue)?\b)/.test(t)) {
    findings.push({
      severity: 'high',
      claim: 'an empty catalogue / no products',
      truth: `the store has ${facts.activeProducts} active product(s) priced €${facts.priceFloor}–€${facts.priceCeiling}`,
    });
  }

  if (facts.realOrders === 0 &&
      /(first revenue|first real (?:order|sale)|first sales?\b|revenue week|sales are coming in|generating revenue|made (?:our|the) first sale)/.test(t)) {
    findings.push({
      severity: 'high',
      claim: 'real revenue / first sales',
      truth: `there are 0 orders at or above the €${facts.priceFloor} price floor — no real sales yet`,
    });
  }

  return findings;
}

async function auditText(text) {
  const facts = await gatherFacts();
  return { facts, findings: audit(text, facts) };
}

module.exports = { gatherFacts, audit, auditText };
