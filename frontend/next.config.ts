import type { NextConfig } from "next";

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
];

const nextConfig: NextConfig = {
  images: {
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