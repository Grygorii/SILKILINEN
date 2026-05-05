'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useCustomer } from '@/context/CustomerContext';
import styles from './page.module.css';

export default function WishlistPage() {
  const { items, toggle, loading } = useWishlist();
  const { customer } = useCustomer();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {!customer && items.length >= 5 && !bannerDismissed && (
          <div className={styles.guestBanner}>
            <p>Don&apos;t lose these favourites — <a href="/account/sign-in" className={styles.bannerLink}>Sign in</a> to access from any device</p>
            <button className={styles.bannerClose} onClick={() => setBannerDismissed(true)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <header className={styles.header}>
          <h1>Wishlist</h1>
          {!loading && items.length > 0 && (
            <p>{items.length} item{items.length !== 1 ? 's' : ''} saved</p>
          )}
        </header>

        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <p>Your wishlist is empty.</p>
            <Link href="/shop" className={styles.shopLink}>Browse the collection →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map(p => (
              <div key={p._id} className={styles.card}>
                <Link href={`/product/${p._id}`} className={styles.imgLink}>
                  <div className={styles.img} />
                </Link>
                <div className={styles.info}>
                  <Link href={`/product/${p._id}`} className={styles.name}>{p.name}</Link>
                  <p className={styles.price}>€{Number(p.price).toFixed(2)}</p>
                  <div className={styles.actions}>
                    <Link href={`/product/${p._id}`} className={styles.viewBtn}>View product</Link>
                    <button className={styles.removeBtn} onClick={() => toggle(p._id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
