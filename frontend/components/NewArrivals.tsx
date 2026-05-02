import Link from 'next/link';
import { colourToHex } from '@/lib/colours';
import styles from './NewArrivals.module.css';

type Product = {
  _id: string;
  name: string;
  price: number;
  colours: string[];
  image?: string;
  createdAt?: string;
};

async function getNewArrivals(): Promise<Product[]> {
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

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 14 * 24 * 60 * 60 * 1000;
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
          <Link key={product._id} href={`/product/${product._id}`} className={styles.card}>
            <div className={styles.imgWrap}>
              {isNew(product.createdAt) && <span className={styles.newBadge}>New</span>}
              {product.image ? (
                <img src={product.image} alt={product.name} className={styles.img} />
              ) : (
                <div className={styles.imgPlaceholder} />
              )}
            </div>
            <div className={styles.info}>
              <p className={styles.name}>{product.name}</p>
              <div className={styles.colours}>
                {product.colours?.map(c => {
                  const hex = colourToHex(c);
                  return (
                    <span
                      key={c}
                      className={styles.dot}
                      title={c}
                      style={hex ? { background: hex, borderColor: hex === '#ffffff' ? '#e0ddd7' : 'transparent' } : undefined}
                    />
                  );
                })}
              </div>
              <p className={styles.price}>€{Number(product.price).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
