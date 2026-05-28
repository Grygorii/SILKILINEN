'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import type { BundleData } from './page';
import styles from './page.module.css';

export default function BundlePageClient({ bundle }: { bundle: BundleData }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart({
      bundleId: bundle._id,
      name: bundle.name,
      price: bundle.bundlePrice,
      colour: '',
      size: '',
      quantity: 1,
      image: bundle.heroImage?.url || bundle.products[0]?.images?.[0]?.url || '',
      includedProducts: bundle.products.map(p => ({
        productId: p._id,
        name: p.name,
        quantity: 1,
      })),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  const hero = bundle.heroImage?.url
    || bundle.products[0]?.images?.[0]?.url
    || null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        {hero ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={hero} alt={bundle.heroImage?.alt || bundle.name} className={styles.heroImg} />
        ) : (
          <div className={styles.heroPlaceholder} />
        )}
        <div className={styles.heroBody}>
          <p className={styles.eyebrow}>Bundle · save {bundle.discountPercent}%</p>
          <h1 className={styles.title}>{bundle.name}</h1>
          {bundle.description && <p className={styles.description}>{bundle.description}</p>}

          <div className={styles.priceRow}>
            <span className={styles.bundlePrice}>€{bundle.bundlePrice.toFixed(2)}</span>
            {bundle.originalTotal > bundle.bundlePrice && (
              <span className={styles.originalPrice}>€{bundle.originalTotal.toFixed(2)}</span>
            )}
            <span className={styles.savings}>You save €{bundle.savings.toFixed(2)}</span>
          </div>

          <button
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={bundle.products.length === 0}
          >
            {bundle.products.length === 0
              ? 'Bundle empty'
              : added ? 'Added to bag' : 'Add bundle to bag'}
          </button>
        </div>
      </section>

      <section className={styles.included}>
        <h2 className={styles.includedTitle}>What&apos;s in this bundle</h2>
        <div className={styles.grid}>
          {bundle.products.map(p => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
