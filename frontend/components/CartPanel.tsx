'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import styles from './CartPanel.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type ShippingZone = {
  label: string;
  cost: number;
  display: string;
};

const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
]);

function getShippingZone(country: string): ShippingZone {
  if (!country) return { label: '', cost: 0, display: 'Calculated at checkout' };
  if (country === 'IE') return { label: 'Standard — Ireland', cost: 4.99, display: '€4.99' };
  if (EU_COUNTRIES.has(country)) return { label: 'Standard — EU', cost: 9.99, display: '€9.99' };
  if (['GB','US','CA','AU'].includes(country)) return { label: 'Standard — International', cost: 14.99, display: '€14.99' };
  return { label: 'Standard — Worldwide', cost: 19.99, display: '€19.99' };
}

const COUNTRIES = [
  { code: '', name: 'Select country…' },
  { code: 'IE', name: 'Ireland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'OTHER', name: 'Other country' },
];

export default function CartPanel({ isOpen, onClose }: Props) {
  const { cart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('');

  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = getShippingZone(country);
  const grandTotal = country ? itemsTotal + shipping.cost : itemsTotal;

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, country }),
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
                  <p className={styles.itemDetails}>{item.colour}{item.size ? ` / ${item.size}` : ''}</p>
                  <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)} × {item.quantity}</p>
                </div>
                <button className={styles.remove} onClick={() => removeFromCart(index)}>✕</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            {/* Country selector */}
            <div className={styles.shippingRow}>
              <label className={styles.shippingLabel} htmlFor="cart-country">Ship to</label>
              <select
                id="cart-country"
                className={styles.countrySelect}
                value={country}
                onChange={e => setCountry(e.target.value)}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>€{itemsTotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Shipping</span>
                <span className={styles.shippingCost}>{country ? shipping.display : 'Calculated at checkout'}</span>
              </div>
              {country && (
                <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                  <span>Total</span>
                  <span>€{grandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.checkout}
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'Redirecting…' : 'Checkout'}
            </button>
            <p className={styles.vatNote}>VAT included · Secure checkout via Stripe</p>
          </div>
        )}
      </div>
    </>
  );
}
