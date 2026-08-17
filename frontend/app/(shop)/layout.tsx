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
import UKShippingNotice from "@/components/UKShippingNotice";
import RouteTracker from "@/components/RouteTracker";
import { InlineEditProvider } from "@/components/inline/InlineEdit";
import { getBannerMessages } from "@/lib/bannerMessages";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getBannerMessages();

  return (
    <InlineEditProvider>
      {/* Every storefront route is recorded, rather than only the two pages
          someone remembered to add a tracker to. */}
      <RouteTracker />
      <SiteHeader messages={messages} />
      <div className="shopContent" data-bar={messages && messages.length > 0 ? 'on' : 'off'}>
        <SiteBreadcrumbs />
        {children}
      </div>
      <Footer />
      <AddedToCartToast />
      <WishlistSignInNudge />
      <EmailCapturePopup />
      <UKShippingNotice />
      <ContactWidget />
      <CookieConsentBanner />
      <MetaPixel />
      <PinterestTag />
    </InlineEditProvider>
  );
}
