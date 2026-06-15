'use strict';

// Editable FAQ — the Q&A used to be hardcoded in the storefront page. Stored as
// a list under SystemState 'faqItems'; the founder edits it in admin. getFaq()
// falls back to DEFAULT_FAQ so the page is never empty. Cached in memory,
// refreshed on save and at boot.

const SystemState = require('../models/SystemState');

const KEY = 'faqItems';

const DEFAULT_FAQ = [
  { q: 'What materials do you use?', a: 'We use 100% mulberry silk and premium linen in all our pieces. Our silk is OEKO-TEX certified, free from harmful substances, and sourced from responsible suppliers. Each piece is made in small batches to maintain quality.' },
  { q: 'How do I find my size?', a: 'We offer XS–XXL in most styles. Our size guide (linked on each product page) includes bust, waist, and hip measurements. If you are between sizes, we recommend sizing up for a relaxed fit or sizing down for a closer silhouette. Feel free to contact us and we can advise based on your measurements.' },
  { q: 'How should I care for silk garments?', a: 'Hand wash in cold water with a gentle detergent, or dry-clean. Never wring — gently press out excess water and lay flat or hang to dry away from direct sunlight. Iron on the lowest setting while slightly damp, on the reverse side. Specific care instructions are included on each product label.' },
  { q: 'Do you ship worldwide?', a: 'Yes. We ship from Donegal, Ireland to most countries. Standard international shipping typically takes 7–14 business days. Expedited options are available at checkout. Customs duties and import taxes for international orders are the responsibility of the recipient.' },
  { q: 'What is your return policy?', a: 'We accept returns within 14 days of delivery for unworn, unwashed items in original condition. To start a return, contact us with your order number. Sale items and personalised pieces are non-refundable. Return shipping costs are the customer\'s responsibility unless the item is faulty.' },
  { q: 'Can I exchange an item for a different size?', a: 'We don’t offer direct exchanges at this time. Return the item within 14 days of delivery for a full refund, then place a new order for the size or colour you’d like — contact us first and we’ll help reserve your preferred piece where we can.' },
  { q: 'How long does it take to process my order?', a: 'All orders are carefully prepared and dispatched within 1–2 business days of payment. During busy periods (sale events, gifting seasons) this may take a little longer. You will receive a shipping confirmation with tracking as soon as your order leaves us.' },
  { q: 'Do you offer gift wrapping?', a: 'All orders are packaged in our signature tissue-wrapped box with a ribbon — suitable for gifting. If you would like a personal note included, add a message in the order notes at checkout.' },
  { q: 'Is your silk ethically sourced?', a: 'We work only with certified suppliers who meet OEKO-TEX Standard 100 requirements. Our production runs in small batches to minimise waste. We are committed to transparency and are happy to answer any questions about our supply chain.' },
  { q: 'Do you have an Etsy shop?', a: 'We do — our Etsy shop is where we first built our customer community. All reviews shown on this site are from verified Etsy purchases. You can now also order directly here for the same quality with faster fulfilment.' },
  { q: 'I have a question not listed here. How can I contact you?', a: 'Reach us via email or the chat button in the bottom-right corner of this page. We aim to respond within one business day.' },
];

let cache = null;

function sanitise(value) {
  if (!Array.isArray(value)) return null;
  const items = value
    .map(i => ({ q: String(i?.q || '').trim().slice(0, 300), a: String(i?.a || '').trim().slice(0, 2000) }))
    .filter(i => i.q && i.a)
    .slice(0, 50);
  return items.length ? items : null;
}

async function loadFaq() {
  try {
    const doc = await SystemState.findOne({ key: KEY }).lean();
    cache = sanitise(doc && doc.value);
  } catch (err) {
    console.warn('[faq] load failed, using defaults:', err.message);
    cache = null;
  }
  return getFaq();
}

function getFaq() {
  return cache && cache.length ? cache : DEFAULT_FAQ;
}

async function saveFaq(items) {
  const clean = sanitise(items) || [];
  await SystemState.findOneAndUpdate({ key: KEY }, { value: clean }, { upsert: true });
  cache = clean.length ? clean : null;
  return getFaq();
}

module.exports = { getFaq, saveFaq, loadFaq, DEFAULT_FAQ };
