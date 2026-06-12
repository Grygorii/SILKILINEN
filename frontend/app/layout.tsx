import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost, EB_Garamond } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import AnalyticsLoader from "@/components/AnalyticsLoader";
import UTMCapture from "@/components/UTMCapture";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";
import CsrfFetchPatch from "@/components/CsrfFetchPatch";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import { isValidSocialUrl } from "@/lib/socialUrl";
import "./globals.css";

// next/font self-hosts the WOFF2 files and inlines a CSS preload, killing
// the ~2 second render-blocking @import that PageSpeed flagged. Display
// swap so text shows in fallback first instead of waiting. The font names
// are aliased to the same names existing CSS uses so module styles don't
// need to be rewritten.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  display: "swap",
  variable: "--font-cormorant",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  variable: "--font-jost",
});

// Text serif for long-form reading (journal articles). Cormorant is a
// display face — its hairline strokes look anaemic at body size. EB
// Garamond is a Garamond cut for text: same classical character, proper
// ink at 18px. Cormorant stays for large display headings.
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  // Only used below the fold (journal body text, product-card names) — never
  // in the hero. Preloading it competed with the LCP hero image for bandwidth
  // on slow connections (2 of the 4 high-priority font preloads were this
  // face). display:swap renders the Georgia fallback first, so dropping the
  // preload costs only a brief late swap on below-fold text.
  preload: false,
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.silkilinen.com'),
  // Title template — every page that sets a `title` becomes
  // "Page Name | Silkilinen". Pages can opt out by setting
  // title: { absolute: '...' }. Brand casing is title-case in
  // titles (the all-caps SILKILINEN is for in-page visual identity,
  // not search snippets where ALL-CAPS reads as shouting).
  title: {
    default: 'Silkilinen — Pure Silk & Linen Intimates',
    template: '%s | Silkilinen',
  },
  description: 'Pure silk and linen intimates, shipped worldwide from Donegal, Ireland.',
  applicationName: 'Silkilinen',
  authors: [{ name: 'Silkilinen' }],
  keywords: ['silk', 'linen', 'intimates', 'sleepwear', 'robes', 'mulberry silk', 'Donegal', 'Irish silk brand'],
  // Help disambiguate from "silkolene" (motorcycle oil) — when the brand
  // is mentioned alongside these terms, Google's confidence in the
  // intended sense improves over time.
  category: 'fashion',
};

// Explicit viewport so iOS Safari doesn't have to infer one. Pinch-zoom
// is deliberately left enabled for accessibility (WCAG 2.1 SC 1.4.4 +
// Lighthouse a11y) but capped at 5x so accidental pinches don't run
// away. themeColor matches the warm-white --color-bg so the iOS status
// bar tints to the brand canvas rather than the default white.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#FAF8F4',
};

// Fetch the brand-level review summary at request time so the
// Organization JSON-LD includes a real aggregateRating. 5s timeout +
// graceful fallback so a slow backend never blocks the layout from
// rendering. GSC flagged Product snippets as missing aggregateRating;
// since reviews aren't linked to specific products in the data model,
// we surface the brand-level rating on Organization instead of
// misattributing brand reviews to individual products.
async function getReviewSummary(): Promise<{ average: number; count: number } | null> {
  const API = process.env.NEXT_PUBLIC_API_URL;
  if (!API) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API}/api/reviews/summary`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.average === 'number' && typeof data?.count === 'number' && data.count > 0) {
      return { average: data.average, count: data.count };
    }
    return null;
  } catch {
    return null;
  }
}

// Active social profile URLs for the Organization `sameAs` — data-driven from
// the same admin source as the footer so the Knowledge-Graph signal doesn't
// drift from what's actually live.
async function getSocialUrls(): Promise<string[]> {
  const API = process.env.NEXT_PUBLIC_API_URL;
  if (!API) return [];
  try {
    const res = await fetch(`${API}/api/social/platforms`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map((p: { url?: string }) => p.url).filter(isValidSocialUrl) : [];
  } catch {
    return [];
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [reviewSummary, socialUrls] = await Promise.all([getReviewSummary(), getSocialUrls()]);
  // ── JSON-LD structured data ──────────────────────────────────────────
  // Two schemas on the root layout, applied to every page:
  //
  // Organization — tells Google who the brand is. Eligible for the
  // Knowledge Graph panel that appears on brand searches. The `sameAs`
  // array is the list of social/external profiles Google uses to
  // cross-verify brand identity — fill these in as the brand grows
  // its presence on each platform.
  //
  // WebSite — needed for the sitelinks search box that appears under
  // big brand results (the "Pyjamas / Luxury Silk Pajamas / Nightwear"
  // links you see under Olivia von Halle's result). Google decides
  // when to show it, but you have to declare you're eligible.
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Silkilinen',
    alternateName: 'SILKILINEN',
    url: 'https://www.silkilinen.com',
    logo: 'https://www.silkilinen.com/og-default.jpg', // replace with a square-format logo when available
    description: 'Pure silk and linen intimates, shipped worldwide from Donegal, Ireland.',
    foundingLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Donegal', addressCountry: 'IE' } },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hello@silkilinen.com',
      areaServed: ['IE', 'GB', 'EU', 'US', 'AU', 'CA'],
      availableLanguage: ['English'],
    },
    sameAs: socialUrls.length
      ? socialUrls
      : ['https://www.instagram.com/silkilinen/', 'https://www.pinterest.com/silkilinen/'],
    // Brand-level aggregateRating. Only emitted when we actually have
    // verified reviews — Google rejects schemas with zero-count or
    // missing values. Reviews aren't linked to products in the data
    // model, so this surfaces here instead of on individual Product
    // schemas (which would misattribute brand reviews per SKU).
    ...(reviewSummary
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: reviewSummary.average,
            reviewCount: reviewSummary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Silkilinen',
    url: 'https://www.silkilinen.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://www.silkilinen.com/shop?search={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable} ${ebGaramond.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        <CsrfFetchPatch />
        <GoogleAuthProvider>
          <CookieConsentProvider>
            <CustomerProvider>
              <WishlistProvider>
                <CartProvider>
                  {children}
                  <AnalyticsLoader />
                  <UTMCapture />
                </CartProvider>
              </WishlistProvider>
            </CustomerProvider>
          </CookieConsentProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}