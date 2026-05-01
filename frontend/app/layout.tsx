import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import CookieConsent from "@/components/CookieConsent";
import NewsletterPopup from "@/components/NewsletterPopup";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silkilinen — Pure Silk & Linen Intimates",
  description: "Handpicked silk and linen intimates, shipped worldwide from Dublin, Ireland.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <WishlistProvider>
          <CartProvider>
            {children}
            <CookieConsent />
            <NewsletterPopup />
          </CartProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}