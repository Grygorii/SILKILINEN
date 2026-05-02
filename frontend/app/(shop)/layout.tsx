import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import AddedToCartToast from "@/components/AddedToCartToast";
import JustSoldPopup from "@/components/JustSoldPopup";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnnouncementBar />
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
