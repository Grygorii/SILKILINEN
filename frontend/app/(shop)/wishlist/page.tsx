'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useCustomer } from '@/context/CustomerContext';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Product = {
  _id: string;
  name: string;
  price: number;
  colours: string[];
  image?: string;
};

export default function WishlistPage() {
  const { wishlist, toggle } = useWishlist();
  const { customer } = useCustomer();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (wishlist.length === 0) { setLoading(false); return; }
    Promise.all(
      wishlist.map(id =>
        fetch(`${API}/api/products/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      setProducts(results.filter(Boolean));
      setLoading(false);
    });
  }, [wishlist]);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {!customer && wishlist.length >= 5 && !bannerDismissed && (
          <div className={styles.guestBanner}>
            <p>Don&apos;t lose these favourites — <a href="/account/sign-in" className={styles.bannerLink}>Sign in</a> to access from any device</p>
            <button className={styles.bannerClose} onClick={() => setBannerDismissed(true)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <header className={styles.header}>
          <h1>Wishlist</h1>
          {!loading && products.length > 0 && (
            <p>{products.length} item{products.length !== 1 ? 's' : ''} saved</p>
          )}
        </header>

        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : wishlist.length === 0 ? (
          <div className={styles.empty}>
            <p>Your wishlist is empty.</p>
            <Link href="/shop" className={styles.shopLink}>Browse the collection →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map(p => (
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
