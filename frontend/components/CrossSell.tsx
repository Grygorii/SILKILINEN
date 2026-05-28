import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './CrossSell.module.css';

async function getRelated(id: string): Promise<ProductCardData[]> {
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
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
}
