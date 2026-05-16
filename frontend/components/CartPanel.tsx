'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import styles from './CartPanel.module.css';

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

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
            cart.map((item, index) => {
              const maxQty = Math.min(item.stock ?? 10, 10);
              const atStockLimit = item.stock !== undefined && item.stock < 10 && item.quantity >= maxQty;
              return (
                <div key={index} className={styles.item}>
                  <div className={styles.itemImg}></div>
                  <div className={styles.itemInfo}>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.itemDetails}>{item.colour}{item.size ? ` / ${item.size}` : ''}</p>
                    <p className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)}</p>
                    {atStockLimit && (
                      <p className={styles.stockNote}>Only {item.stock} available</p>
                    )}
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
                  <button className={styles.remove} onClick={() => removeFromCart(index)} aria-label="Remove item">✕</button>
                </div>
              );
            })
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
            <button className={styles.checkout} onClick={() => { onClose(); router.push('/checkout'); }}>
              Checkout
            </button>
            <p className={styles.vatNote}>Secure checkout via Stripe</p>
          </div>
        )}
      </div>
    </>
  );
}
