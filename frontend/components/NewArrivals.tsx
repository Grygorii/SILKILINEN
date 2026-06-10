import { type ProductCardData } from './ProductCard';
import NewArrivalsCarousel from './NewArrivalsCarousel';

async function getNewArrivals(): Promise<ProductCardData[]> {
  try {
    // Only products the admin has flagged with "Show NEW badge on storefront"
    // (isNewArrival) appear here — not the newest-by-date heuristic. No longer
    // capped at 4: the carousel shows however many have been flagged.
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/products?isNew=true&sort=-createdAt&limit=24`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function NewArrivals() {
  const products = await getNewArrivals();
  if (products.length === 0) return null;
  return <NewArrivalsCarousel products={products} />;
}
