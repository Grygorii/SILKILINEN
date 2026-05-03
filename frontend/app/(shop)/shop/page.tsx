import ProductGrid from '@/components/ProductGrid';
import styles from './page.module.css';

export const metadata = {
  title: 'Shop — SILKILINEN',
  description: 'Browse the full SILKILINEN collection of pure silk and linen intimates. Robes, slips, dresses and sets, shipped worldwide from Dublin.',
};

async function getProducts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, { cache: 'no-store' });
  const products = await res.json();
  return products;
}

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>All products</h1>
        <p>Handpicked silk &amp; linen pieces</p>
      </div>
      <ProductGrid products={products} />
    </main>
  );
}