import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import AnalyticsLoader from "@/components/AnalyticsLoader";
import UTMCapture from "@/components/UTMCapture";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
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