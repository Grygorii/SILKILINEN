'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Lock } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import styles from './CartPanel.module.css';

const FREE_SHIPPING_THRESHOLD = 150;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartPanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        );
        focusable[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const toFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingPct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.headerTitle}>Your cart</h3>
            {itemCount > 0 && (
              <span className={styles.headerCount}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            )}
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close cart">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Line items ── */}
        <div className={styles.items}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Your cart is empty.</p>
              <p className={styles.emptySub}>When you add silk, it&apos;ll live here until you check out.</p>
              <button className={styles.shopBtn} onClick={onClose}>Shop the collection</button>
            </div>
          ) : (
            cart.map((item, index) => {
              const maxQty = Math.min(item.stock ?? 10, 10);
              const atStockLimit = item.stock !== undefined && item.stock < 10 && item.quantity >= maxQty;
              return (
                <div key={index} className={styles.item}>
                  {/* Thumbnail — 4:5 portrait */}
                  <div className={styles.itemImg}>
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className={styles.itemImgEl} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    )}
                  </div>

                  {/* Info column */}
                  <div className={styles.itemInfo}>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.itemDetails}>
                      {item.colour}{item.size ? ` / ${item.size}` : ''}
                    </p>

                    {/* Price row — price left, remove × right */}
                    <div className={styles.itemPriceRow}>
                      <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)}</p>
                      <button
                        className={styles.remove}
                        onClick={() => removeFromCart(index)}
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    </div>

                    {atStockLimit && (
                      <p className={styles.stockNote}>Only {item.stock} available</p>
                    )}

                    {/* Quantity stepper */}
                    <div className={styles.stepperWrap}>
                      <button
                        className={styles.stepBtn}
                        onClick={() => updateQuantity(index, -1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >−</button>
                      <span className={styles.stepVal}>{item.quantity}</span>
                      <button
                        className={styles.stepBtn}
                        onClick={() => updateQuantity(index, 1)}
                        disabled={item.quantity >= maxQty}
                        aria-label="Increase quantity"
                      >+</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Sticky footer ── */}
        {cart.length > 0 && (
          <div className={styles.footer}>
            {/* Free shipping progress */}
            {toFreeShipping > 0 ? (
              <div className={styles.freeShipping}>
                <div className={styles.freeShippingBar} role="progressbar" aria-valuenow={Math.round(freeShippingPct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={styles.freeShippingFill} style={{ width: `${freeShippingPct}%` }} />
                </div>
                <p className={styles.freeShippingText}>
                  €{toFreeShipping.toFixed(0)} more for free shipping to Ireland
                </p>
              </div>
            ) : (
              <p className={styles.freeShippingMet}>Free shipping to Ireland ✓</p>
            )}

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Shipping</span>
                <span className={styles.shippingNote}>Calculated at checkout</span>
              </div>
              <div className={styles.totalRowFinal}>
                <span>Total</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              className={styles.checkout}
              onClick={() => { onClose(); router.push('/checkout'); }}
            >
              Checkout
            </button>

            <p className={styles.trust}>
              <Lock size={11} strokeWidth={1.5} aria-hidden="true" />
              Secure checkout · Stripe
            </p>
          </div>
        )}
      </div>
    </>
  );
}
