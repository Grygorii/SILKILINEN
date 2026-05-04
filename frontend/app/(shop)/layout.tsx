import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import AddedToCartToast from "@/components/AddedToCartToast";
import JustSoldPopup from "@/components/JustSoldPopup";
import WishlistSignInNudge from "@/components/WishlistSignInNudge";
import EmailCapturePopup from "@/components/EmailCapturePopup";
import ContactWidget from "@/components/ContactWidget";
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
    <>
      <AnnouncementBar messages={messages.length > 0 ? messages : undefined} />
      <Navbar />
      <div className="shopContent">
        {children}
      </div>
      <Footer />
      <AddedToCartToast />
      <JustSoldPopup />
      <WishlistSignInNudge />
      <EmailCapturePopup />
      <ContactWidget />
    </>
  );
}
