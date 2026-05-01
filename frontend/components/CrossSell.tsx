import Link from 'next/link';
import { colourToHex } from '@/lib/colours';
import styles from './CrossSell.module.css';

type Product = {
  _id: string;
  name: string;
  price: number;
  colours: string[];
  image?: string;
};

async function getRelated(id: string): Promise<Product[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/products/related/${id}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function CrossSell({ productId }: { productId: string }) {
  const related = await getRelated(productId);
  if (related.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>You might also like</h2>
      <div className={styles.grid}>
        {related.map(p => (
          <Link key={p._id} href={`/product/${p._id}`} className={styles.card}>
            <div className={styles.img} />
            <div className={styles.info}>
              <p className={styles.name}>{p.name}</p>
              <div className={styles.colours}>
                {p.colours?.slice(0, 4).map(c => {
                  const hex = colourToHex(c);
                  return (
                    <span
                      key={c}
                      className={styles.dot}
                      title={c}
                      style={hex ? { background: hex } : undefined}
                    />
                  );
                })}
              </div>
              <p className={styles.price}>€{Number(p.price).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
