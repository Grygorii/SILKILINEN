import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

// Origin of the backend API (every fetch goes here) — read at build so the CSP
// matches whatever NEXT_PUBLIC_API_URL is set to, without hardcoding it.
const apiOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL || '').origin; } catch { return ''; }
})();

// Content-Security-Policy — shipped FIRST as Report-Only: the browser reports
// violations (in the DevTools console) but BLOCKS NOTHING, so checkout (Stripe),
// images (Cloudinary) and the pixels can't break while we confirm the real origin
// list. Once a walk-through of checkout + shop is clean, flip the header key below
// to 'Content-Security-Policy' to enforce. 'unsafe-inline' is required: Next
// injects inline hydration scripts and the app uses inline styles (a nonce-based
// CSP would force dynamic rendering on every page — wrong trade-off here).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://*.js.stripe.com https://www.googletagmanager.com https://connect.facebook.net https://s.pinimg.com https://www.gstatic.com https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://ct.pinterest.com https://s.pinimg.com https://*.google.com https://*.gstatic.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''} https://api.stripe.com https://m.stripe.network https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://ct.pinterest.com https://s.pinimg.com https://res.cloudinary.com`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  // Block the site from being embedded in iframes elsewhere (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from guessing file types (MIME sniffing protection)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs when users click links to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features the site doesn't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // 2-year HSTS with includeSubDomains + preload — what Lighthouse Best-
  // Practices wants and what's required for the chromium HSTS preload list.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Defence-in-depth vs XSS / card-skimming. REPORT-ONLY for now (blocks nothing);
  // flip the key to 'Content-Security-Policy' to enforce once a clean walk-through
  // confirms the origin list.
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

const nextConfig: NextConfig = {
  images: {
    // Global custom loader so next/image routes through Cloudinary's transforms.
    // Configured here (not as a per-<Image loader> prop) because a function prop
    // can't be passed from a Server Component to the <Image> client component.
    loader: 'custom',
    loaderFile: './lib/cloudinaryLoader.ts',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // /blog was replaced by /journal. 301 so any Google-indexed
      // legacy URLs (caring-for-your-silk, the-linen-story,
      // sleep-better-in-silk) keep working and forward equity to
      // the journal route.
      { source: '/blog', destination: '/journal', permanent: true },
      { source: '/blog/:slug', destination: '/journal/:slug', permanent: true },
      // The Privacy Policy lives at /privacy-policy. GSC reported /privacy
      // as a 404 (the cookie banner used to link there); 301 forwards the
      // already-crawled URL and any external links to the real page.
      { source: '/privacy', destination: '/privacy-policy', permanent: true },
      // Canonicalise to the www host. All metadata, sitemap, robots and
      // JSON-LD declare https://www.silkilinen.com, but the bare apex was
      // serving requests directly (GSC reported a 5xx on
      // silkilinen.com/product/…). 301 every apex request to its www
      // equivalent so there is a single indexable host.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'silkilinen.com' }],
        destination: 'https://www.silkilinen.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;