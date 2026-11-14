'use strict';

// Pricing advice has to be stricter than competitor browsing. A catalogue-wide
// average can be useful context, but it cannot tell us whether one eye mask or
// robe is priced correctly. This module only works from current, currency-known
// products in the same product family, and it never writes to the catalogue.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 21;
const MIN_COMPARABLE_BRANDS = 3;
const SUPPORTED_CURRENCIES = new Set(['EUR', 'GBP', 'USD']);

const SEGMENTS = [
  { key: 'eye-mask', label: 'silk eye masks', patterns: [/\beye\s*mask\b/i, /\beyemask\b/i, /\bsleep\s*mask\b/i] },
  { key: 'pillowcase', label: 'silk pillowcases', patterns: [/\bpillow\s*case\b/i, /\bpillowcase\b/i] },
  { key: 'robe', label: 'silk robes', patterns: [/\brobe\b/i, /\bkimono\b/i, /\bdressing\s*gown\b/i] },
  { key: 'nightwear', label: 'silk nightwear', patterns: [/\bnight\s*dress\b/i, /\bnightdress\b/i, /\bnightshirt\b/i, /\bslip\s*dress\b/i, /\bpyjamas?\b/i, /\bpajamas?\b/i, /\bsleepwear\b/i] },
  { key: 'underwear', label: 'silk underwear', patterns: [/\bbriefs?\b/i, /\bpant(?:y|ies)\b/i, /\bbralette\b/i, /\bbras?\b/i, /\bbikini\b/i, /\bboxer\b/i] },
  { key: 'scarf', label: 'silk scarves', patterns: [/\bscarf\b/i] },
  { key: 'bedding', label: 'silk bedding', patterns: [/\bduvet\b/i, /\bsheet\b/i, /\bbedding\b/i, /\bbed\s*linen\b/i] },
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, places = 2) {
  const n = number(value);
  if (n == null) return null;
  const power = 10 ** places;
  return Math.round(n * power) / power;
}

function median(values) {
  const sorted = values.filter(value => number(value) != null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, point) {
  const sorted = values.filter(value => number(value) != null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * point;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function familyFor(value) {
  const text = [value?.name, value?.category, value?.description].filter(Boolean).join(' ');
  return SEGMENTS.find(segment => segment.patterns.some(pattern => pattern.test(text))) || null;
}

function sampleMatchesFamily(sample, family) {
  if (!family) return false;
  const text = [sample?.title, sample?.type].filter(Boolean).join(' ');
  return family.patterns.some(pattern => pattern.test(text));
}

function supportedCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(currency) ? currency : null;
}

// exchangeRates.getRates() returns foreign currency per EUR, so a GBP/USD
// listed price becomes EUR by dividing by that rate.
function toEur(amount, currency, rates) {
  const price = number(amount);
  const code = supportedCurrency(currency);
  if (price == null || price <= 0 || !code) return null;
  const rate = number(rates?.[code]);
  if (code === 'EUR') return round(price);
  return rate && rate > 0 ? round(price / rate) : null;
}

function isCurrent(profile, now) {
  const scrapedAt = new Date(profile?.lastScrapedAt || 0).getTime();
  return Number.isFinite(scrapedAt) && scrapedAt > 0 && now.getTime() - scrapedAt <= MAX_AGE_DAYS * DAY_MS;
}

function unitCost(product) {
  const cost = number(product?.costing?.totalUnitCost);
  return cost != null && cost >= 0 ? cost : null;
}

function costState(product) {
  const current = unitCost(product);
  const legacy = number(product?.costPrice);
  if (current == null) return { state: 'missing', unitCost: null, marginBeforeFees: null };
  if (legacy != null && Math.abs(legacy - current) > 0.009) {
    return { state: 'conflict', unitCost: current, marginBeforeFees: null };
  }
  const price = number(product?.price);
  return {
    state: 'known',
    unitCost: current,
    marginBeforeFees: price && price > 0 ? round(((price - current) / price) * 100, 1) : null,
  };
}

function representativeSample(samples, marketPrice) {
  return [...samples].sort((a, b) => Math.abs(a.priceEur - marketPrice) - Math.abs(b.priceEur - marketPrice))[0];
}

function marketComparables(product, profiles, rates, now) {
  const family = familyFor(product);
  if (!family) return { family: null, observations: [], ignoredUnknownCurrency: 0, ignoredStale: 0 };

  let ignoredUnknownCurrency = 0;
  let ignoredStale = 0;
  const observations = [];

  for (const profile of profiles || []) {
    if (!isCurrent(profile, now)) {
      ignoredStale++;
      continue;
    }
    const currency = supportedCurrency(profile.currency);
    const matches = (profile.sampleProducts || [])
      .filter(sample => sampleMatchesFamily(sample, family))
      .map(sample => ({
        ...sample,
        priceEur: toEur(sample.price, currency, rates),
      }))
      .filter(sample => sample.priceEur != null);

    if (!currency && (profile.sampleProducts || []).some(sample => sampleMatchesFamily(sample, family) && number(sample.price) != null)) {
      ignoredUnknownCurrency++;
    }
    if (!matches.length) continue;

    const marketPrice = median(matches.map(sample => sample.priceEur));
    const source = representativeSample(matches, marketPrice);
    observations.push({
      competitor: profile.name || profile.domain,
      domain: profile.domain,
      platform: profile.platform,
      currency,
      observedPrice: round(source.price),
      priceEur: round(marketPrice),
      title: source.title || '',
      url: source.url || '',
      scrapedAt: profile.lastScrapedAt || null,
    });
  }

  return { family, observations, ignoredUnknownCurrency, ignoredStale };
}

function evidenceBand(observations) {
  const prices = observations.map(item => item.priceEur).filter(price => price != null);
  if (prices.length < MIN_COMPARABLE_BRANDS) return null;
  return {
    low: round(percentile(prices, 0.25)),
    median: round(median(prices)),
    high: round(percentile(prices, 0.75)),
    min: round(Math.min(...prices)),
    max: round(Math.max(...prices)),
  };
}

function proposedTestPrice(price, lowerBand) {
  const ceiling = Math.min(lowerBand, price * 1.1);
  if (ceiling <= price) return null;
  return Math.max(Math.round(price + 1), Math.round((price + ceiling) / 2));
}

function positionFor(price, band) {
  if (!band) return { key: 'insufficient', label: 'Insufficient comparable evidence', deltaFromMedian: null };
  const deltaFromMedian = round(((price - band.median) / band.median) * 100, 1);
  if (price < band.low * 0.95) return { key: 'below', label: 'Below the observed peer band', deltaFromMedian };
  if (price > band.high * 1.05) return { key: 'above', label: 'Above the observed peer band', deltaFromMedian };
  return { key: 'aligned', label: 'Within the observed peer band', deltaFromMedian };
}

function descriptionIdea(product) {
  if (!String(product?.materialComposition || '').trim()) {
    return 'Make the verified material composition easy to see beside the price before changing the price.';
  }
  if (/silk/i.test(product.materialComposition) && !String(product?.momme || '').trim()) {
    return 'Add the silk weight only after it is confirmed; it is a useful value proof, but it must never be guessed.';
  }
  if (!String(product?.fitNote || '').trim() && /robe|nightwear|underwear/.test(familyFor(product)?.key || '')) {
    return 'Add a verified fit or sizing detail so a higher price feels considered rather than uncertain.';
  }
  return 'Lead with the verified fabric detail, then one specific use moment; keep the price tied to facts rather than a vague luxury claim.';
}

function marketingIdea(family) {
  switch (family?.key) {
    case 'eye-mask': return 'Show it as a quiet bedtime or travel ritual, paired with a relevant pillowcase rather than discounted alone.';
    case 'pillowcase': return 'Build a considered sleep ritual around fabric feel, care, and a complementary eye mask or gift pairing.';
    case 'robe': return 'Use a slow-morning editorial scene and clear fit detail to make the robe feel like an intentional wardrobe piece.';
    case 'nightwear': return 'Sell the silhouette and evening ritual through movement, fit, and fabric detail before using any offer.';
    case 'underwear': return 'Lead with fit, colour, and fabric feel; keep promotion secondary to confidence in the product page.';
    case 'scarf': return 'Show two ways to wear or gift it so the shopper understands the piece beyond a single product shot.';
    default: return 'Build one simple story around the verified fabric, finish, and use occasion instead of competing on the lowest price.';
  }
}

function recommendationFor({ product, market, band, position, costing, familyPriceReview, sales }) {
  if (familyPriceReview) {
    return {
      key: 'review_price_architecture',
      title: 'Review the colour-family price ladder',
      detail: 'Linked colour variants have different prices. Keep the difference only when there is a documented change in fabric, construction, inclusions, or cost.',
    };
  }
  if (costing.state === 'missing') {
    return {
      key: 'complete_costing_first',
      title: 'Add unit costing before considering a price move',
      detail: 'Competitor prices cannot tell you whether this product is profitable. Complete material, labour, and packaging cost first.',
    };
  }
  if (costing.state === 'conflict') {
    return {
      key: 'complete_costing_first',
      title: 'Reconcile the two cost records first',
      detail: 'The legacy cost and the finance unit cost disagree, so a pricing proposal would not be reliable.',
    };
  }
  if (!band) {
    return {
      key: 'collect_more_evidence',
      title: 'Keep the price under review; collect better evidence',
      detail: `Only ${market.observations.length} current, currency-confirmed comparable brand${market.observations.length === 1 ? '' : 's'} were found. A whole-shop average is not a substitute.`,
    };
  }
  if (position.key === 'below') {
    const testPrice = proposedTestPrice(product.price, band.low);
    if (sales?.units >= 2 && testPrice != null) {
      return {
        key: 'consider_controlled_test',
        title: `Consider a small, time-bound test at €${testPrice}`,
        detail: 'This product has sold at its current price and sits below the comparable peer band. Test one modest step upward; do not use a blanket price increase.',
        testPrice,
      };
    }
    return {
      key: 'protect_position',
      title: 'Protect the position; do not discount',
      detail: 'The current ticket sits below comparable peers. Make the product value easier to understand before assuming a lower price will sell more.',
    };
  }
  if (position.key === 'above') {
    return {
      key: 'strengthen_value_proof',
      title: 'Strengthen the reason for the premium before changing price',
      detail: 'The ticket is above the observed peer band. Do not cut it from competitor data alone; first make fabric, fit, finish, care, and delivery confidence clearer.',
    };
  }
  return {
    key: 'hold_price',
    title: 'Hold the price and sell the reason for it',
    detail: 'The ticket sits inside the current comparable peer band. Compete through clarity, product proof, and presentation—not a reflex discount.',
  };
}

function familyPriceReview(product, productMap) {
  const siblings = (product.colorVariants || [])
    .map(item => productMap.get(String(item?.productId || item)))
    .filter(Boolean);
  const prices = [product, ...siblings].map(item => number(item.price)).filter(price => price != null);
  return prices.length > 1 && new Set(prices).size > 1;
}

function salesFor(product, salesByProduct) {
  const value = salesByProduct?.[String(product?._id)] || salesByProduct?.get?.(String(product?._id));
  return { units: Math.max(0, Number(value?.units || 0)), revenue: round(value?.revenue || 0) || 0 };
}

function confidenceFor({ band, observations, ignoredUnknownCurrency }) {
  if (!band) return { key: 'insufficient', label: 'Insufficient', reason: 'There are fewer than three current, currency-confirmed comparable brands.' };
  if (observations.length >= 5 && ignoredUnknownCurrency === 0) return { key: 'strong', label: 'Strong', reason: 'Five or more current, direct comparable brands with confirmed currencies.' };
  return { key: 'limited', label: 'Limited', reason: 'Comparable products are present, but the sample is still a market indication rather than a price mandate.' };
}

function analyseProduct(product, profiles, rates, now, productMap, salesByProduct) {
  const market = marketComparables(product, profiles, rates, now);
  const band = evidenceBand(market.observations);
  const position = positionFor(product.price, band);
  const costing = costState(product);
  const sales = salesFor(product, salesByProduct);
  const familyReview = familyPriceReview(product, productMap);
  const recommendation = recommendationFor({ product, market, band, position, costing, familyPriceReview: familyReview, sales });
  return {
    product: {
      id: String(product._id),
      name: product.name,
      price: round(product.price),
      category: product.category || '',
      materialComposition: product.materialComposition || '',
      momme: product.momme || '',
      status: product.status,
    },
    family: market.family ? { key: market.family.key, label: market.family.label } : null,
    cost: costing,
    sales,
    position,
    confidence: confidenceFor({ band, observations: market.observations, ignoredUnknownCurrency: market.ignoredUnknownCurrency }),
    market: {
      band,
      comparableBrands: market.observations.length,
      ignoredUnknownCurrency: market.ignoredUnknownCurrency,
      ignoredStale: market.ignoredStale,
      evidence: market.observations,
    },
    recommendation,
    descriptionIdea: descriptionIdea(product),
    marketingIdea: marketingIdea(market.family),
  };
}

function buildCompetitorPricingAdvice({ products = [], profiles = [], rates = { EUR: 1 }, salesByProduct = new Map(), now = new Date() } = {}) {
  const productMap = new Map(products.map(product => [String(product._id), product]));
  const productAdvice = products
    .filter(product => number(product.price) != null && product.price > 0)
    .map(product => analyseProduct(product, profiles, rates, now, productMap, salesByProduct))
    .sort((a, b) => a.product.name.localeCompare(b.product.name));

  const count = key => productAdvice.filter(item => item.recommendation.key === key).length;
  return {
    policy: 'Advisory only. No price, description, or campaign change is made here.',
    method: {
      minComparableBrands: MIN_COMPARABLE_BRANDS,
      maxProfileAgeDays: MAX_AGE_DAYS,
      note: 'Numeric comparisons use only current, currency-confirmed products in the same product family. Whole-shop averages are browsing context only.',
    },
    summary: {
      products: productAdvice.length,
      profiles: (profiles || []).length,
      currentProfiles: (profiles || []).filter(profile => isCurrent(profile, now)).length,
      withComparableEvidence: productAdvice.filter(item => item.confidence.key !== 'insufficient').length,
      costingMissing: productAdvice.filter(item => item.cost.state === 'missing' || item.cost.state === 'conflict').length,
      reviewPriceArchitecture: count('review_price_architecture'),
      controlledTests: count('consider_controlled_test'),
    },
    products: productAdvice,
  };
}

module.exports = {
  MAX_AGE_DAYS,
  MIN_COMPARABLE_BRANDS,
  familyFor,
  supportedCurrency,
  toEur,
  buildCompetitorPricingAdvice,
};
