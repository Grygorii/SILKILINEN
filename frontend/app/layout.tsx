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
  metadataBase: new URL('https://silkilinen.com'),
  title: "Silkilinen — Pure Silk & Linen Intimates",
  description: "Handpicked silk and linen intimates, shipped worldwide from Donegal, Ireland.",
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
  return (
    <html lang="en">
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