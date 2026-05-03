'use client';

import { useCart } from '@/context/CartContext';
import { useWishlist, type WishlistProduct } from '@/context/WishlistContext';
import styles from '../account.module.css';

export default function WishlistPage() {
  const { addToCart } = useCart();
  const { items, toggle, loading } = useWishlist();

  function moveToCart(product: WishlistProduct) {
    addToCart({ name: product.name, price: product.price, colour: '', size: '', quantity: 1 });
    toggle(product._id);
  }

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
          <p>Your wishlist is empty.</p>
          <a href="/shop">Browse the collection</a>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.wishGrid}>
          {items.map(p => (
            <div key={p._id} className={styles.wishCard}>
              <div className={styles.wishImg}>
                {p.image && <img src={p.image} alt={p.name} />}
              </div>
              <div className={styles.wishInfo}>
                <p className={styles.wishName}>{p.name}</p>
                <p className={styles.wishPrice}>€{Number(p.price).toFixed(2)}</p>
              </div>
              <div className={styles.wishActions}>
                <button className={styles.wishBtn} onClick={() => moveToCart(p)}>Add to cart</button>
                <button className={`${styles.wishBtn} ${styles.wishBtnRemove}`} onClick={() => toggle(p._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
