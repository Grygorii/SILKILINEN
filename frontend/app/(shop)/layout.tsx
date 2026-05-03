import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import AddedToCartToast from "@/components/AddedToCartToast";
import JustSoldPopup from "@/components/JustSoldPopup";
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
      <div style={{ paddingTop: '120px' }}>
        {children}
      </div>
      <Footer />
      <AddedToCartToast />
      <JustSoldPopup />
    </>
  );
}
