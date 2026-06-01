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
    ];
  },
};

export default nextConfig;