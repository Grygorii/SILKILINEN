'use strict';

const Product = require('../models/Product');
const Order = require('../models/Order');

// ── Known frontend configuration (source of truth for consistency checks) ──

const FRONTEND_CATEGORIES = ['gifts', 'robes', 'pyjamas', 'dresses', 'lingerie', 'accessories', 'shorts', 'shirts', 'scarves'];

const SIDEMENU_LINKS = [
  { label: 'SHOP ALL', href: '/shop', filter: null },
  { label: 'GIFTS', href: '/shop?category=gifts', filter: 'gifts' },
  { label: 'ROBES', href: '/shop?category=robes', filter: 'robes' },
  { label: 'PYJAMAS', href: '/shop?category=pyjamas', filter: 'pyjamas' },
  { label: 'DRESSES', href: '/shop?category=dresses', filter: 'dresses' },
  { label: 'LINGERIE', href: '/shop?category=lingerie', filter: 'lingerie' },
  { label: 'ACCESSORIES', href: '/shop?category=accessories', filter: 'accessories' },
  { label: 'ABOUT', href: '/about', filter: null },
];

const FOOTER_LINKS = [
  { label: 'New arrivals', href: '/shop' },
  { label: 'All products', href: '/shop' },
  { label: 'Robes', href: '/shop?category=robes' },
  { label: 'Dresses', href: '/shop?category=dresses' },
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
  for (const link of SIDEMENU_LINKS) {
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
  for (const link of SIDEMENU_LINKS) {
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

  // Frontend categories that have NO matching products in DB
  for (const cat of FRONTEND_CATEGORIES) {
    if (!dbCategories.includes(cat)) {
      const similar = dbCategories.filter(c =>
        c.includes(cat) || cat.includes(c) || levenshtein(c, cat) <= 2
      );
      findings.push(finding(
        'critical',
        'consistency',
        `Frontend category "${cat}" has no matching products in DB`,
        `DB has categories: ${dbCategories.join(', ')}`,
        `SideMenu > /shop?category=${cat}`,
        similar.length > 0
          ? `Rename DB category "${similar[0]}" to "${cat}" in the database`
          : `Add products with category="${cat}" or remove it from the navigation`,
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

  // DB categories not surfaced in frontend nav
  const unexposedCategories = dbCategories.filter(c => c && !FRONTEND_CATEGORIES.includes(c));
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

async function runAudit(audit) {
  const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://silkilinen.com').replace(/\/$/, '');
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

  audit.findings = allFindings;
  audit.completedAt = new Date();
  audit.duration = Date.now() - new Date(audit.runAt).getTime();
  audit.status = 'completed';
  await audit.save();
}

module.exports = { runAudit };
