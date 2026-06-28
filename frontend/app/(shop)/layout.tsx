import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import AddedToCartToast from "@/components/AddedToCartToast";
import WishlistSignInNudge from "@/components/WishlistSignInNudge";
import EmailCapturePopup from "@/components/EmailCapturePopup";
import ContactWidget from "@/components/ContactWidget";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MetaPixel from "@/components/MetaPixel";
import PinterestTag from "@/components/PinterestTag";
import SiteBreadcrumbs from "@/components/SiteBreadcrumbs";
import { InlineEditProvider } from "@/components/inline/InlineEdit";
import { getContent } from "@/lib/content";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const banner = await getContent('banner');
  const messages = [1, 2, 3, 4]
    .map(i => banner[`banner_message_${i}`]?.value)
    .filter((m): m is string => Boolean(m));

  return (
    <InlineEditProvider>
      <SiteHeader messages={messages.length > 0 ? messages : undefined} />
      <div className="shopContent">
        <SiteBreadcrumbs />
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
    </InlineEditProvider>
  );
}
