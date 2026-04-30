import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';

async function getProduct(id: string) {
  const res = await fetch(`https://silkilinen-production.up.railway.app/api/products/${id}`);
  const product = await res.json();
  return product;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.image}>
          <div className={styles.placeholder}></div>
        </div>
        <div className={styles.info}>
          <a href="/shop" className={styles.back}>← Back to shop</a>
          <h1>{product.name}</h1>
          <p className={styles.price}>€{product.price}.00</p>
          <p className={styles.description}>{product.description}</p>
          <ProductOptions
            colours={product.colours}
            sizes={product.sizes}
            productName={product.name}
            price={product.price}
          />
        </div>
      </div>
    </main>
  );
}