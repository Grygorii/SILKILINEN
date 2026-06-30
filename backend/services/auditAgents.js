'use strict';

const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');

// The storefront nav is data-driven: it lists ACTIVE Category docs that have at
// least one product (see /api/categories + Navbar). Audit against that live
// source — not a hardcoded list — so we test the menu customers actually see
// and don't false-flag categories the nav already hides.
async function liveNavCategories() {
  const [cats, counts] = await Promise.all([
    Category.find({ status: 'active' }).sort({ displayOrder: 1, createdAt: 1 }).select('slug label').lean().catch(() => []),
    Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out'] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]).catch(() => []),
  ]);
  const countBySlug = Object.fromEntries(counts.map(c => [c._id, c.count]));
  return cats.map(c => ({ slug: String(c.slug).toLowerCase(), label: c.label, count: countBySlug[c.slug] || 0 }));
}

// AI reasoning layer — turns raw deterministic findings into a prioritised,
// root-cause read. It doesn't see the code; it reasons from the findings + how
// this Next.js + Express + MongoDB stack works. Fail-soft: the audit still
// completes (with synthesis: null) if AI is unavailable.
const AUDIT_REASONER_SYSTEM = `You are the lead engineer reviewing an automated Site Audit for SILKILINEN — a Next.js (frontend) + Express + MongoDB (backend) quiet-luxury silk & linen shop. You are handed RAW deterministic findings (broken links, failing API flows, data inconsistencies, missing SEO). You do NOT have the code — reason from the findings and how this stack works.

Return ONLY JSON:
{
  "headline": "one honest sentence on the site's real health",
  "priorities": [ { "issue": "which finding(s) this covers", "severity": "critical|warning|info", "likelyCause": "the most probable root cause", "whereToLook": "the file / route / area to check first (be specific to this stack, e.g. routes/checkoutV2.js, the product route, app/sitemap.ts)", "fix": "the concrete first step" } ],
  "noise": "any findings that are likely false alarms or low value, and why — or empty string"
}
Order priorities by real business impact: a broken checkout or product page beats a missing meta description. Group related findings into one priority. If there are zero findings, return a clean-bill headline and an empty priorities array.`;

async function synthesizeFindings(findings) {
  if (!findings.length || !process.env.DEEPSEEK_API_KEY) return null;
  const client = require('./aiClient');
  const list = findings.map((f, i) =>
    `${i + 1}. [${f.severity}] (${f.agent}) ${f.title}${f.location ? ' @ ' + f.location : ''}${f.detail ? ' — ' + f.detail : ''}`).join('\n');
  const res = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat',
    messages: [
      { role: 'system', content: AUDIT_REASONER_SYSTEM },
      { role: 'user', content: `The Site Audit found these ${findings.length} issue(s):\n\n${list}\n\nReason over them.` },
    ],
    temperature: 0.3, max_tokens: 900, response_format: { type: 'json_object' },
  }, { timeout: 40000, maxRetries: 1 });
  return JSON.parse(res.choices[0]?.message?.content || 'null');
}

const FOOTER_LINKS = [
  { label: 'New arrivals', href: '/shop' },
  { label: 'All products', href: '/shop' },
  { label: 'Robes', href: '/shop?category=robes' },
  { label: 'Sleep Dresses', href: '/shop?category=sleep-dresses' },
  { label: 'About us', href: '/about' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Shipping', href: '/shipping' },
  { label: 'Size guide', href: '/size-guide' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms & conditions', href: '/terms' },
  { label: 'Returns & refunds', href: '/returns' },
  { label: 'FAQ', href: '/faq' },
];

const CORE_PAGES = [
  { label: 'Homepage', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Account sign-in', href: '/account/sign-in' },
  { label: 'Wishlist', href: '/wishlist' },
  { label: 'Blog / Journal', href: '/blog' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function checkUrl(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'SILKILINEN-Audit/1.0' },
    });
    clearTimeout(timer);
    return { status: res.status, ok: res.status < 400 };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, ok: false, error: err.message };
  }
}

function finding(severity, agent, title, detail, location, suggestion) {
  return { severity, agent, title, detail: detail || '', location: location || '', suggestion: suggestion || '' };
}

// ── Agent 1: Navigation & Routing ────────────────────────────────────────────

async function runNavigationAgent(frontendUrl) {
  const findings = [];
  const checked = [];

  // The category links the storefront actually shows (active categories with
  // products) + the structural links that bracket them.
  const navCats = (await liveNavCategories()).filter(c => c.count > 0);
  const sidemenuLinks = [
    { label: 'SHOP ALL', href: '/shop', filter: null },
    ...navCats.map(c => ({ label: c.label, href: `/shop?category=${c.slug}`, filter: c.slug })),
    { label: 'ABOUT', href: '/about', filter: null },
  ];

  // 1. Core pages
  for (const page of CORE_PAGES) {
    const url = `${frontendUrl}${page.href}`;
    const result = await checkUrl(url);
    checked.push({ label: page.label, url, ...result });

    if (!result.ok) {
      findings.push(finding(
        result.status === 404 ? 'critical' : 'warning',
        'navigation',
        `${page.label} page returns ${result.status || 'error'}`,
        result.error || `HTTP ${result.status}`,
        url,
        `Create the page at ${page.href} or fix the routing error`,
      ));
    }
  }

  // 2. SideMenu links
  for (const link of sidemenuLinks) {
    const url = `${frontendUrl}${link.href}`;
    const result = await checkUrl(url);
    checked.push({ label: `SideMenu > ${link.label}`, url, ...result });

    if (!result.ok) {
      findings.push(finding(
        'critical',
        'navigation',
        `SideMenu "${link.label}" page returns ${result.status || 'error'}`,
        `Link: ${link.href}`,
        `Hamburger menu > ${link.label}`,
        `Verify route ${link.href} exists and renders correctly`,
      ));
    }
  }

  // 3. Footer links
  for (const link of FOOTER_LINKS) {
    const url = `${frontendUrl}${link.href}`;
    const result = await checkUrl(url);
    checked.push({ label: `Footer > ${link.label}`, url, ...result });

    if (!result.ok) {
      findings.push(finding(
        result.status === 404 ? 'critical' : 'warning',
        'navigation',
        `Footer "${link.label}" returns ${result.status || 'error'}`,
        `Link: ${link.href}`,
        `Footer > ${link.label}`,
        `Create the page at ${link.href} or update the footer link`,
      ));
    }
  }

  // 4. SideMenu category filter correctness (API-level check)
  for (const link of sidemenuLinks) {
    if (!link.filter) continue;

    const count = await Product.countDocuments({
      category: link.filter,
      status: { $in: ['active', 'sold_out', null, undefined] },
    });

    if (count === 0) {
      // Check if there are products with similar categories (naming mismatch)
      const allCategories = await Product.distinct('category');
      const similar = allCategories.filter(c =>
        c && (c.toLowerCase().includes(link.filter) || link.filter.includes(c.toLowerCase()))
      );

      findings.push(finding(
        'critical',
        'navigation',
        `SideMenu "${link.label}" filter finds 0 products`,
        `Category filter "?category=${link.filter}" returns no active products. DB has categories: ${allCategories.filter(Boolean).join(', ')}`,
        `SideMenu > ${link.label} → /shop?category=${link.filter}`,
        similar.length > 0
          ? `Rename DB category from "${similar.join('" or "')}" to "${link.filter}", or update the nav link`
          : `Add products with category="${link.filter}" or add a redirect`,
      ));
    } else {
      // Verify the products actually have that exact category
      const sample = await Product.findOne({
        category: link.filter,
        status: { $in: ['active', 'sold_out', null, undefined] },
      }).select('name category');

      if (sample && sample.category !== link.filter) {
        findings.push(finding(
          'warning',
          'navigation',
          `Category case mismatch for "${link.label}"`,
          `Frontend uses "${link.filter}", DB has "${sample.category}"`,
          `SideMenu > ${link.label}`,
          `Normalise category to lowercase: "${link.filter}"`,
        ));
      }
    }
  }

  // 5. Product detail page — test with a real product ID
  const sampleProduct = await Product.findOne({
    status: { $in: ['active', null, undefined] },
  }).select('_id name').lean();

  if (sampleProduct) {
    const productUrl = `${frontendUrl}/product/${sampleProduct._id}`;
    const result = await checkUrl(productUrl);
    checked.push({ label: `Product page (${sampleProduct.name})`, url: productUrl, ...result });

    if (!result.ok) {
      findings.push(finding(
        'critical',
        'navigation',
        `Product detail page returns ${result.status || 'error'}`,
        `Tested with product: ${sampleProduct.name} (${sampleProduct._id})`,
        productUrl,
        'Check SSR errors on the product detail page',
      ));
    }
  } else {
    findings.push(finding(
      'warning',
      'navigation',
      'No active products found to test product detail page',
      'Cannot verify product page renders correctly without a published product',
      '/shop',
      'Add at least one active product',
    ));
  }

  return { findings, checkedCount: checked.length };
}

// ── Agent 2: User Journey Inspector ──────────────────────────────────────────

async function runJourneysAgent(frontendUrl, backendUrl) {
  const findings = [];

  // ── Flow A: Browse → Product → Cart ──
  const flowA = { name: 'Browse → Product → Cart', steps: [] };

  // Step 1: Products load
  try {
    const res = await fetch(`${backendUrl}/api/products`, { headers: { 'User-Agent': 'SILKILINEN-Audit/1.0' } });
    const products = await res.json();
    const list = Array.isArray(products) ? products : [];

    if (list.length === 0) {
      flowA.steps.push({ label: 'Products visible on /shop', pass: false, detail: 'API returned 0 products' });
      findings.push(finding(
        'critical',
        'journeys',
        'Flow A: No products visible on /shop',
        '/api/products returned empty array',
        '/shop',
        'Ensure products exist with status="active" in the database',
      ));
    } else {
      flowA.steps.push({ label: 'Products visible on /shop', pass: true, detail: `${list.length} products loaded` });

      // Step 2: Product detail accessible
      const first = list[0];
      try {
        const pRes = await fetch(`${backendUrl}/api/products/${first._id}`, { headers: { 'User-Agent': 'SILKILINEN-Audit/1.0' } });
        const product = await pRes.json();

        if (product.error) {
          flowA.steps.push({ label: 'Product detail page loads', pass: false, detail: product.error });
          findings.push(finding(
            'critical',
            'journeys',
            'Flow A: Product detail API returns error',
            product.error,
            `/product/${first._id}`,
            'Investigate product route handler',
          ));
        } else {
          flowA.steps.push({ label: 'Product detail page loads', pass: true, detail: `"${product.name}" loaded` });

          // Step 3: Images
          const hasImages = (product.images?.length > 0) || product.image;
          if (!hasImages) {
            flowA.steps.push({ label: 'Product has at least one image', pass: false, detail: 'No images or image URL found' });
            findings.push(finding(
              'warning',
              'journeys',
              `Flow A: Product "${product.name}" has no images`,
              'Product detail page will show an empty placeholder',
              `/product/${product._id}`,
              'Upload images for this product in /admin/products',
            ));
          } else {
            flowA.steps.push({ label: 'Product has images', pass: true });
          }

          // Step 4: Price is valid
          const price = Number(product.price);
          if (!price || price <= 0) {
            flowA.steps.push({ label: 'Product has valid price', pass: false, detail: `Price is ${product.price}` });
            findings.push(finding(
              'critical',
              'journeys',
              `Flow A: Product "${product.name}" has invalid price`,
              `Price: ${product.price}`,
              `/product/${product._id}`,
              'Set a valid price greater than 0 in /admin/products',
            ));
          } else {
            flowA.steps.push({ label: 'Product has valid price', pass: true, detail: `€${price.toFixed(2)}` });
          }
        }
      } catch (err) {
        flowA.steps.push({ label: 'Product detail loads', pass: false, detail: err.message });
        findings.push(finding('critical', 'journeys', 'Flow A: Product detail fetch failed', err.message, `/product/${first._id}`, 'Check API connectivity'));
      }
    }
  } catch (err) {
    flowA.steps.push({ label: 'Products API reachable', pass: false, detail: err.message });
    findings.push(finding('critical', 'journeys', 'Flow A: Products API unreachable', err.message, '/api/products', 'Check backend is running and NEXT_PUBLIC_API_URL is set correctly'));
  }

  // ── Flow B: Wishlist ──
  const flowB = { name: 'Wishlist', steps: [] };
  // Wishlist is localStorage-only (no API) — check the page exists
  const wishlistCheck = await checkUrl(`${frontendUrl}/wishlist`);
  if (!wishlistCheck.ok) {
    flowB.steps.push({ label: 'Wishlist page accessible', pass: false, detail: `HTTP ${wishlistCheck.status}` });
    findings.push(finding('critical', 'journeys', 'Flow B: Wishlist page is not accessible', `Returns ${wishlistCheck.status}`, '/wishlist', 'Verify the /wishlist page exists and renders'));
  } else {
    flowB.steps.push({ label: 'Wishlist page accessible', pass: true });
  }

  // ── Flow C: Auth / Magic Link ──
  const flowC = { name: 'Sign-in', steps: [] };
  try {
    const signInPage = await checkUrl(`${frontendUrl}/account/sign-in`);
    flowC.steps.push({
      label: 'Sign-in page accessible',
      pass: signInPage.ok,
      detail: signInPage.ok ? 'OK' : `HTTP ${signInPage.status}`,
    });
    if (!signInPage.ok) {
      findings.push(finding('critical', 'journeys', 'Flow C: Sign-in page returns error', `HTTP ${signInPage.status}`, '/account/sign-in', 'Check the sign-in page component for SSR errors'));
    }
  } catch (err) {
    flowC.steps.push({ label: 'Sign-in page accessible', pass: false, detail: err.message });
  }

  // Check magic-link API responds
  try {
    const mlRes = await fetch(`${backendUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SILKILINEN-Audit/1.0' },
      body: JSON.stringify({ email: 'audit-test@silkilinen-qa.invalid' }),
    });
    // Should return 200 (sent) or 4xx for invalid email — not 500
    const data = await mlRes.json().catch(() => ({}));
    if (mlRes.status >= 500) {
      flowC.steps.push({ label: 'Magic link API functional', pass: false, detail: `HTTP ${mlRes.status}` });
      findings.push(finding('critical', 'journeys', 'Flow C: Magic link API returns 5xx', JSON.stringify(data), '/api/auth/magic-link', 'Check the auth route for server errors'));
    } else {
      flowC.steps.push({ label: 'Magic link API reachable', pass: true, detail: `HTTP ${mlRes.status}` });
    }
  } catch (err) {
    flowC.steps.push({ label: 'Magic link API reachable', pass: false, detail: err.message });
    findings.push(finding('warning', 'journeys', 'Flow C: Magic link API unreachable', err.message, '/api/auth/magic-link', 'Verify the backend auth route'));
  }

  // ── Flow D: Checkout API ──
  const flowD = { name: 'Checkout API', steps: [] };
  try {
    const checkoutRes = await fetch(`${backendUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SILKILINEN-Audit/1.0' },
      body: JSON.stringify({ items: [] }),
    });
    // Empty cart should return 400, not 500
    if (checkoutRes.status >= 500) {
      flowD.steps.push({ label: 'Checkout API reachable', pass: false, detail: `HTTP ${checkoutRes.status}` });
      findings.push(finding('critical', 'journeys', 'Flow D: Checkout API returns 5xx', `HTTP ${checkoutRes.status}`, '/api/checkout', 'Check the checkout route for server errors'));
    } else {
      flowD.steps.push({ label: 'Checkout API reachable', pass: true, detail: `HTTP ${checkoutRes.status} (expected 4xx for empty cart)` });
    }
  } catch (err) {
    flowD.steps.push({ label: 'Checkout API reachable', pass: false, detail: err.message });
    findings.push(finding('critical', 'journeys', 'Flow D: Checkout API unreachable', err.message, '/api/checkout', 'Check Stripe configuration and backend routes'));
  }

  // ── Newsletter subscription ──
  try {
    const nlRes = await fetch(`${backendUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SILKILINEN-Audit/1.0' },
      body: JSON.stringify({ email: 'audit-test@silkilinen-qa.invalid', source: 'audit' }),
    });
    if (nlRes.status >= 500) {
      findings.push(finding('warning', 'journeys', 'Newsletter subscription API returns 5xx', `HTTP ${nlRes.status}`, '/api/newsletter', 'Check the newsletter route and Resend configuration'));
    }
  } catch {
    // Non-critical if newsletter isn't reachable from within the server
  }

  const flows = [flowA, flowB, flowC, flowD];
  const passed = flows.reduce((n, f) => n + f.steps.filter(s => s.pass).length, 0);
  const total = flows.reduce((n, f) => n + f.steps.length, 0);

  return { findings, flows, passed, total };
}

// ── Agent 3: Cross-Surface Consistency Inspector ──────────────────────────────

async function runConsistencyAgent() {
  const findings = [];

  // 1. Category consistency
  const dbCategories = (await Product.distinct('category')).filter(Boolean).map(c => c.toLowerCase());
  const activeCategories = (await Product.distinct('category', {
    status: { $in: ['active', null, undefined] },
  })).filter(Boolean).map(c => c.toLowerCase());

  // The live storefront categories (active Category docs). The nav already hides
  // any with no products, so an empty category isn't a customer-facing dead link
  // — it's tidiness, surfaced as a warning, not a critical.
  const frontendCategories = (await liveNavCategories()).map(c => c.slug);

  for (const cat of frontendCategories) {
    if (!dbCategories.includes(cat)) {
      const similar = dbCategories.filter(c =>
        c.includes(cat) || cat.includes(c) || levenshtein(c, cat) <= 2
      );
      findings.push(finding(
        'warning',
        'consistency',
        `Category "${cat}" has no products yet (hidden from nav)`,
        `DB has product categories: ${dbCategories.join(', ')}`,
        `/shop?category=${cat}`,
        similar.length > 0
          ? `Reassign products from "${similar[0]}" to "${cat}", or archive the empty category`
          : `Add a product in "${cat}", or archive the category if it's not in use`,
      ));
    } else if (!activeCategories.includes(cat)) {
      findings.push(finding(
        'warning',
        'consistency',
        `Category "${cat}" exists in DB but has no active products`,
        'Products exist but are all draft or archived',
        `/shop?category=${cat}`,
        `Publish at least one product in category "${cat}"`,
      ));
    }
  }

  // DB product-categories with no live category page / nav link.
  const unexposedCategories = dbCategories.filter(c => c && !frontendCategories.includes(c));
  for (const cat of unexposedCategories) {
    const count = await Product.countDocuments({ category: cat, status: { $in: ['active', null, undefined] } });
    if (count > 0) {
      findings.push(finding(
        'info',
        'consistency',
        `DB category "${cat}" is not linked in the navigation (${count} active products)`,
        `${count} active product(s) with category="${cat}" are not accessible via nav`,
        'SideMenu / Footer',
        `Add a nav link for "${cat}" or reassign those products to an existing category`,
      ));
    }
  }

  // 2. Product count consistency — API vs DB
  const dbTotalActive = await Product.countDocuments({ status: { $in: ['active', null, undefined] } });
  const dbTotalAll = await Product.countDocuments({});

  if (dbTotalActive === 0 && dbTotalAll > 0) {
    findings.push(finding(
      'warning',
      'consistency',
      `${dbTotalAll} products exist but none are "active"`,
      `All ${dbTotalAll} products have status=draft or archived`,
      '/shop',
      'Set at least some products to status="active" so they appear on the shop',
    ));
  }

  // 3. Products missing critical fields
  const noPrice = await Product.countDocuments({ $or: [{ price: { $exists: false } }, { price: 0 }, { price: null }] });
  if (noPrice > 0) {
    findings.push(finding(
      'critical',
      'consistency',
      `${noPrice} product(s) have no price`,
      'These will appear on the shop with €0.00',
      '/admin/products',
      'Set a price greater than 0 for all products',
    ));
  }

  const noImages = await Product.countDocuments({
    status: { $in: ['active', null, undefined] },
    images: { $size: 0 },
    image: { $in: [null, '', undefined] },
  });
  if (noImages > 0) {
    findings.push(finding(
      'warning',
      'consistency',
      `${noImages} active product(s) have no images`,
      'Product cards and detail pages will show an empty placeholder',
      '/admin/products',
      'Upload at least one image for each active product',
    ));
  }

  // 4. Products missing SEO
  const noSeo = await Product.countDocuments({
    status: { $in: ['active', null, undefined] },
    $or: [{ metaTitle: { $in: [null, ''] } }, { metaDescription: { $in: [null, ''] } }],
  });
  if (noSeo > 0) {
    findings.push(finding(
      'info',
      'consistency',
      `${noSeo} active product(s) missing SEO meta fields`,
      'Missing metaTitle or metaDescription — will use fallback values',
      '/admin/products',
      'Run "Generate SEO with AI" or manually fill meta fields for each product',
    ));
  }

  // 5. Recent orders — any stuck in "pending" for >2 hours?
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  let stuckOrders = 0;
  try {
    stuckOrders = await Order.countDocuments({ status: 'pending', createdAt: { $lt: twoHoursAgo } });
  } catch { /* Order model may differ */ }

  if (stuckOrders > 0) {
    findings.push(finding(
      'warning',
      'consistency',
      `${stuckOrders} order(s) stuck in "pending" for >2 hours`,
      'These may indicate a Stripe webhook delivery failure',
      '/admin/orders',
      'Check Stripe webhook logs and manually update order status if payment was captured',
    ));
  }

  // 6. No 404 page check — verify a random bad URL returns 404-like response
  // (can't check status code from server-side easily, flag as info)
  findings.push(finding(
    'info',
    'consistency',
    'Verify custom 404 page exists',
    'Next.js shows its default 404 if no custom not-found.tsx exists',
    '/app/not-found.tsx',
    'Create frontend/app/not-found.tsx with a branded 404 page',
  ));

  return { findings };
}

// ── Simple Levenshtein for category name matching ────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Main orchestrator ────────────────────────────────────────────────────────

// ── Agent 4: On-page SEO hygiene ─────────────────────────────────────────────
// Crawls the rendered HTML of key public pages and re-checks the SEO rules that
// have bitten us before (an external crawler flagged: missing meta description,
// images without alt, titles >60 chars, more than one <h1>). This is the
// regression guard — every fix we make is encoded as a check here, so a future
// run flags the moment one comes back. Pure regex parsing, no new dependency.

const SEO_STATIC_PAGES = [
  '/', '/shop', '/about', '/contact', '/faq', '/reviews', '/shipping',
  '/returns', '/size-guide', '/terms', '/privacy-policy', '/gift-wrapping',
  '/journal', '/style-finder',
];

async function fetchHtml(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SILKILINEN-Audit/1.0' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, html: await res.text() };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Parse one page's HTML and return the SEO issues found. Each rule mirrors a
// real fix; keep them in sync when you correct a new class of mistake.
function auditPageHtml(html) {
  const issues = [];

  // Title — present, not truncated, and descriptive (Google Starter Guide).
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  if (!title) issues.push({ sev: 'warning', type: 'Title tag missing', detail: '', sugg: 'Set a page title in metadata.' });
  else if (title.length > 60) issues.push({ sev: 'warning', type: 'Title too long', detail: `${title.length} chars — "${title}"`, sugg: 'Trim the title (or the product metaTitle) to ≤60 chars so Google does not truncate it.' });
  else if (title.length < 15) issues.push({ sev: 'info', type: 'Title very short', detail: `${title.length} chars — "${title}"`, sugg: 'Use a fuller, descriptive title (~30–60 chars) led by the primary term.' });

  // Meta description — present, unique, concise (≤160).
  const metaTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  const desc = (metaTag ? (metaTag[0].match(/content=["']([^"']*)["']/i)?.[1] || '') : '').trim();
  if (!metaTag || !desc) issues.push({ sev: 'warning', type: 'Meta description missing', detail: '', sugg: 'Add a 120–160 char meta description (per-page metadata or the metaDescription field).' });
  else if (desc.length > 160) issues.push({ sev: 'info', type: 'Meta description too long', detail: `${desc.length} chars`, sugg: 'Trim to ≤160 chars so Google does not truncate the snippet.' });
  else if (desc.length < 50) issues.push({ sev: 'info', type: 'Meta description very short', detail: `${desc.length} chars`, sugg: 'Aim for 120–160 chars to fill the snippet with a real summary.' });

  // Heading structure — exactly one <h1>.
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) issues.push({ sev: 'info', type: 'More than one h1', detail: `${h1Count} <h1> tags on the page`, sugg: 'Keep a single <h1> per page; demote the others to <h2>.' });
  else if (h1Count === 0) issues.push({ sev: 'info', type: 'No h1 tag', detail: '', sugg: 'Add one <h1> describing the page.' });

  // Canonical — avoid duplicate-URL dilution (the guide's canonicalisation point).
  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) {
    issues.push({ sev: 'info', type: 'Canonical tag missing', detail: '', sugg: 'Add a self-referencing canonical (alternates.canonical) so duplicate URLs do not split signals.' });
  }

  // Images — descriptive alt (presence AND quality).
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const altOf = (t) => { const m = t.match(/\balt\s*=\s*["']([^"']*)["']/i); return m ? m[1].trim() : null; };
  const noAlt = imgs.filter(t => !altOf(t)).length; // null or empty (empty = intentional decorative)
  if (noAlt > 0) issues.push({ sev: 'warning', type: 'Image alt text missing', detail: `${noAlt} of ${imgs.length} images have no/empty alt`, sugg: 'Give every content image descriptive alt text (decorative images may use alt="" intentionally).' });
  const junkAlt = imgs.filter(t => { const a = altOf(t); return a && a.length > 0 && a.length <= 2; }).length;
  if (junkAlt > 0) issues.push({ sev: 'info', type: 'Non-descriptive image alt', detail: `${junkAlt} image(s) have a 1–2 character alt`, sugg: 'Use alt text that describes what the image shows (e.g. "Champagne silk robe, front").' });

  return issues;
}

// Core Web Vitals via Google PageSpeed Insights (mobile, lab + real-user CrUX).
// PSI is slow, so callers sample only a couple of key URLs. Works keyless at low
// volume; set PAGESPEED_API_KEY for reliable runs.
async function measureWebVitals(url) {
  const key = process.env.PAGESPEED_API_KEY;
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&strategy=mobile${key ? `&key=${key}` : ''}`;
  const res = await fetch(api, { signal: AbortSignal.timeout(28000) });
  if (!res.ok) throw new Error(`PageSpeed HTTP ${res.status}`);
  const data = await res.json();
  const score = data.lighthouseResult?.categories?.performance?.score;
  return {
    score: score == null ? null : Math.round(score * 100),
    lcp: data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || null,
    cls: data.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || null,
    fieldOverall: data.loadingExperience?.overall_category || null, // FAST | AVERAGE | SLOW
  };
}

async function runSeoHygieneAgent(frontendUrl, backendUrl) {
  const findings = [];

  // Static pages + a sample of each dynamic template so PDP / collection /
  // article / bundle regressions are caught too (sampled, not the whole
  // catalogue — keeps the run fast and bounded).
  const urls = [...SEO_STATIC_PAGES];
  try {
    const sample = async (apiPath, toUrl, n) => {
      const r = await fetch(`${backendUrl}${apiPath}`, { headers: { 'User-Agent': 'SILKILINEN-Audit/1.0' }, signal: AbortSignal.timeout(8000) }).then(x => x.ok ? x.json() : []).catch(() => []);
      const arr = Array.isArray(r) ? r : (r.articles || r.collections || r.bundles || r.items || []);
      for (const it of arr.slice(0, n)) { const u = toUrl(it); if (u) urls.push(u); }
    };
    await sample('/api/products?slim=true&limit=3', p => p._id && `/product/${p._id}`, 3);
    await sample('/api/collections', c => c.slug && `/collections/${c.slug}`, 2);
    await sample('/api/journal', a => a.slug && `/journal/${a.slug}`, 2);
    await sample('/api/bundles', b => b.slug && `/bundles/${b.slug}`, 2);
  } catch { /* sampling is best-effort; static pages still audited */ }

  for (const path of urls) {
    const url = `${frontendUrl}${path}`;
    const res = await fetchHtml(url);
    if (!res.ok) {
      findings.push(finding('warning', 'seo', `Could not audit ${path}`, res.error || `HTTP ${res.status}`, url, 'Check the page renders for crawlers.'));
      continue;
    }
    for (const i of auditPageHtml(res.html)) {
      findings.push(finding(i.sev, 'seo', `${i.type} — ${path}`, i.detail, url, i.sugg));
    }
  }

  // Core Web Vitals / page experience — a Google ranking signal. Sample the
  // homepage + one product (PSI is slow, so keep it bounded + best-effort).
  const cwvTargets = ['/'];
  const firstProduct = urls.find(p => p.startsWith('/product/'));
  if (firstProduct) cwvTargets.push(firstProduct);
  for (const path of cwvTargets) {
    const url = `${frontendUrl}${path}`;
    try {
      const v = await measureWebVitals(url);
      const bits = [
        v.score != null ? `mobile score ${v.score}/100` : null,
        v.lcp ? `LCP ${v.lcp}` : null,
        v.cls ? `CLS ${v.cls}` : null,
        v.fieldOverall ? `real-user: ${v.fieldOverall}` : null,
      ].filter(Boolean).join(' · ');
      if (v.fieldOverall === 'SLOW' || (v.score != null && v.score < 50)) {
        findings.push(finding('warning', 'seo', `Core Web Vitals poor — ${path}`, bits, url, 'Page experience is a ranking signal — fix the LCP element (preload the hero image), cut layout shift, and trim JS.'));
      } else if (v.fieldOverall === 'AVERAGE' || (v.score != null && v.score < 90)) {
        findings.push(finding('info', 'seo', `Core Web Vitals could improve — ${path}`, bits, url, 'Aim for a 90+ mobile performance score and "good" Core Web Vitals.'));
      }
      // "good" / 90+ → no finding (clean bill)
    } catch (err) {
      findings.push(finding('info', 'seo', `Core Web Vitals not measured — ${path}`, err.message, url, 'PageSpeed Insights was unreachable or rate-limited; set PAGESPEED_API_KEY for reliable measurement.'));
    }
  }

  return { findings, checkedCount: urls.length };
}

async function runAudit(audit) {
  const FRONTEND_URL = 'https://silkilinen.com';
  const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

  const allFindings = [];

  // Agent 1
  const navStart = Date.now();
  audit.agents.navigation.status = 'running';
  await audit.save();
  try {
    const { findings, checkedCount } = await runNavigationAgent(FRONTEND_URL);
    allFindings.push(...findings);
    audit.agents.navigation.status = 'done';
    audit.agents.navigation.duration = Date.now() - navStart;
    audit.agents.navigation.findingsCount = findings.length;
    audit.agents.navigation.criticalCount = findings.filter(f => f.severity === 'critical').length;
    audit.agents.navigation.warningCount = findings.filter(f => f.severity === 'warning').length;
    audit.agents.navigation.infoCount = findings.filter(f => f.severity === 'info').length;
  } catch (err) {
    audit.agents.navigation.status = 'error';
    audit.agents.navigation.error = err.message;
  }
  await audit.save();

  // Agent 2
  const journeyStart = Date.now();
  audit.agents.journeys.status = 'running';
  await audit.save();
  try {
    const { findings, flows, passed, total } = await runJourneysAgent(FRONTEND_URL, BACKEND_URL);
    allFindings.push(...findings);
    audit.agents.journeys.status = 'done';
    audit.agents.journeys.duration = Date.now() - journeyStart;
    audit.agents.journeys.findingsCount = findings.length;
    audit.agents.journeys.criticalCount = findings.filter(f => f.severity === 'critical').length;
    audit.agents.journeys.warningCount = findings.filter(f => f.severity === 'warning').length;
    audit.agents.journeys.infoCount = findings.filter(f => f.severity === 'info').length;
  } catch (err) {
    audit.agents.journeys.status = 'error';
    audit.agents.journeys.error = err.message;
  }
  await audit.save();

  // Agent 3
  const consistencyStart = Date.now();
  audit.agents.consistency.status = 'running';
  await audit.save();
  try {
    const { findings } = await runConsistencyAgent();
    allFindings.push(...findings);
    audit.agents.consistency.status = 'done';
    audit.agents.consistency.duration = Date.now() - consistencyStart;
    audit.agents.consistency.findingsCount = findings.length;
    audit.agents.consistency.criticalCount = findings.filter(f => f.severity === 'critical').length;
    audit.agents.consistency.warningCount = findings.filter(f => f.severity === 'warning').length;
    audit.agents.consistency.infoCount = findings.filter(f => f.severity === 'info').length;
  } catch (err) {
    audit.agents.consistency.status = 'error';
    audit.agents.consistency.error = err.message;
  }

  // Agent 4 — on-page SEO hygiene (the regression guard)
  const seoStart = Date.now();
  audit.agents.seo.status = 'running';
  await audit.save();
  try {
    const { findings } = await runSeoHygieneAgent(FRONTEND_URL, BACKEND_URL);
    allFindings.push(...findings);
    audit.agents.seo.status = 'done';
    audit.agents.seo.duration = Date.now() - seoStart;
    audit.agents.seo.findingsCount = findings.length;
    audit.agents.seo.criticalCount = findings.filter(f => f.severity === 'critical').length;
    audit.agents.seo.warningCount = findings.filter(f => f.severity === 'warning').length;
    audit.agents.seo.infoCount = findings.filter(f => f.severity === 'info').length;
  } catch (err) {
    audit.agents.seo.status = 'error';
    audit.agents.seo.error = err.message;
  }

  audit.findings = allFindings;

  // AI reasoning layer — prioritise the findings and read the likely root causes.
  try {
    audit.synthesis = await synthesizeFindings(allFindings);
  } catch (err) {
    console.warn('[audit] synthesis failed:', err.message);
  }

  audit.completedAt = new Date();
  audit.duration = Date.now() - new Date(audit.runAt).getTime();
  audit.status = 'completed';
  await audit.save();
}

module.exports = { runAudit };
