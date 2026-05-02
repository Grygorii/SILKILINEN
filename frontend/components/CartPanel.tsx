'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { trackBeginCheckout } from '@/lib/analytics';
import styles from './CartPanel.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartPanel({ isOpen, onClose }: Props) {
  const { cart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCheckout() {
    trackBeginCheckout(subtotal, cart.reduce((n, i) => n + i.quantity, 0));
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <h3>Your cart</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close cart">✕</button>
        </div>

        <div className={styles.items}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <p>Your cart is empty.</p>
              <p>Discover our collection and find something you love.</p>
              <button className={styles.shopBtn} onClick={onClose}>Shop now</button>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className={styles.item}>
                <div className={styles.itemImg}></div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemDetails}>{item.colour}{item.size ? ` / ${item.size}` : ''}</p>
                  <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)} × {item.quantity}</p>
                </div>
                <button className={styles.remove} onClick={() => removeFromCart(index)} aria-label="Remove item">✕</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Shipping</span>
                <span className={styles.shippingNote}>Calculated at checkout</span>
              </div>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.checkout} onClick={handleCheckout} disabled={loading}>
              {loading ? 'Redirecting…' : 'Checkout'}
            </button>
            <p className={styles.vatNote}>Secure checkout via Stripe</p>
          </div>
        )}
      </div>
    </>
  );
}
