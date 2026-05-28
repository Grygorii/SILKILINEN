import Link from 'next/link';
import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './NewArrivals.module.css';

async function getNewArrivals(): Promise<ProductCardData[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/products?sort=-createdAt&limit=4`,
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

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Arrivals</h2>
        <Link href="/shop" className={styles.viewAll}>View all →</Link>
      </div>
      <div className={styles.grid}>
        {products.map(product => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
