'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import styles from '../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Product = { _id: string; name: string; price: number; image?: string; category?: string };

export default function WishlistPage() {
  const { addToCart } = useCart();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/customers/me/wishlist`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setItems(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    await fetch(`${API}/api/customers/me/wishlist/${id}`, { method: 'DELETE', credentials: 'include' });
    setItems(prev => prev.filter(p => p._id !== id));
  }

  function moveToCart(product: Product) {
    addToCart({ name: product.name, price: product.price, colour: '', size: '', quantity: 1 });
    remove(product._id);
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
                <button className={`${styles.wishBtn} ${styles.wishBtnRemove}`} onClick={() => remove(p._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
