import type { Metadata, Viewport } from "next";
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
import "./globals.css";

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
  description: 'Handpicked silk and linen intimates, shipped worldwide from Donegal, Ireland.',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    description: 'Handpicked silk and linen intimates, shipped worldwide from Donegal, Ireland.',
    foundingLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Donegal', addressCountry: 'IE' } },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hello@silkilinen.com',
      areaServed: ['IE', 'GB', 'EU', 'US', 'AU', 'CA'],
      availableLanguage: ['English'],
    },
    sameAs: [
      // Fill these in as the accounts go live; each verified profile
      // strengthens Google's brand-identity confidence.
      'https://www.instagram.com/silkilinen/',
      'https://www.pinterest.com/silkilinen/',
      // 'https://www.tiktok.com/@silkilinen',
    ].filter(Boolean),
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
    <html lang="en">
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