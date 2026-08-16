import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import AddedToCartToast from "@/components/AddedToCartToast";
import WishlistSignInNudge from "@/components/WishlistSignInNudge";
import EmailCapturePopup from "@/components/EmailCapturePopup";
import ContactWidget from "@/components/ContactWidget";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MetaPixel from "@/components/MetaPixel";
import PinterestTag from "@/components/PinterestTag";
import { getBannerMessages } from "@/lib/bannerMessages";

// Mirrors app/(shop)/layout.tsx so journal listing and article pages
// pick up the same header, footer, cookie banner, and tracking pixels
// as the rest of the storefront. The preview route at
// app/journal/preview/ lives outside this group so it stays bare
// (the PREVIEW MODE banner is the only chrome there, intentionally).
export default async function JournalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getBannerMessages();

  return (
    <>
      <SiteHeader messages={messages} />
      <div className="shopContent" data-bar={messages && messages.length > 0 ? 'on' : 'off'}>
        {children}
      </div>
      <Footer />
      <AddedToCartToast />
      <WishlistSignInNudge />
      <EmailCapturePopup />
      <ContactWidget />
      <CookieConsentBanner />
      <MetaPixel />
      <PinterestTag />
    </>
  );
}
