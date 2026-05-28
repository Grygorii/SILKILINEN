'use client';

import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import styles from '../account.module.css';

export default function WishlistPage() {
  const { items, loading } = useWishlist();

  return (
    <>
      <a href="/account" className={styles.back}>← Back to account</a>
      <div className={styles.pageHeader}>
        <h1>Wishlist</h1>
        <p>{items.length} saved item{items.length === 1 ? '' : 's'}</p>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div className={styles.emptyState}>
          <p>Nothing saved yet.</p>
          <a href="/shop">Explore the collection</a>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.wishGrid}>
          {items.map(p => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}
