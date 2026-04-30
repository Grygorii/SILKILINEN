'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import styles from './CartPanel.module.css';

const API = 'https://silkilinen-production.up.railway.app';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartPanel({ isOpen, onClose }: Props) {
  const { cart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCheckout() {
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
          <button className={styles.close} onClick={onClose}>✕</button>
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
                  <p className={styles.itemDetails}>{item.colour} / {item.size}</p>
                  <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)} × {item.quantity}</p>
                </div>
                <button className={styles.remove} onClick={() => removeFromCart(index)}>✕</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.total}>
              <span>Total</span>
              <span>€{total.toFixed(2)}</span>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.checkout}
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'Redirecting…' : 'Checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
