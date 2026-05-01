import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';

async function getProduct(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <p>This product could not be found.</p>
          <a href="/shop" className={styles.back}>← Back to shop</a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.image}>
          <div className={styles.placeholder}></div>
        </div>
        <div className={styles.info}>
          <a href="/shop" className={styles.back}>← Back to shop</a>
          <h1>{product.name}</h1>
          <p className={styles.price}>€{Number(product.price).toFixed(2)}</p>
          <p className={styles.description}>{product.description}</p>
          <ProductOptions
            colours={product.colours ?? []}
            sizes={product.sizes ?? []}
            productName={product.name}
            price={product.price}
          />
        </div>
      </div>
    </main>
  );
}
