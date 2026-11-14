'use client';

import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { usePathname, useRouter } from 'next/navigation';
import { X, Lock } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import ProductImage from './products/ProductImage';
import Button from './ui/Button';
import UKShipBadge from './UKShipBadge';
import styles from './CartPanel.module.css';
import { useFreeShippingThreshold } from '@/lib/useFreeShipping';
import { localeFromPathname, localeHref } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';


type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartPanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const locale = localeFromPathname(usePathname());
  const copy = getDictionary(locale);
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { format } = useCurrency();
  const freeShippingThreshold = useFreeShippingThreshold();
  const panelRef = useRef<HTMLDivElement>(null);
  // Focus behaviour for the aria-modal below. This file and SideMenu each
  // carried their own copy, identical down to the selector string and the 50ms
  // timeout — and six other dialogs on the site had none at all.
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Swipe-right to close (panel slides in from right)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isOpen) return;

    let startX = 0, startY = 0, startTime = 0;
    let direction: 'horizontal' | 'vertical' | null = null;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      direction = null;
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (direction === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        direction = Math.abs(dx) > Math.abs(dy) && dx > 0 ? 'horizontal' : 'vertical';
      }
      if (direction === 'horizontal' && dx > 0) {
        e.preventDefault();
        panel!.style.transition = 'none';
        panel!.style.transform = `translateX(${dx}px)`;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (direction !== 'horizontal') return;
      const dx = e.changedTouches[0].clientX - startX;
      const velocity = dx / (Date.now() - startTime);
      const shouldClose = dx > panel!.offsetWidth * 0.3 || velocity > 0.5;

      panel!.style.transition = '';
      panel!.getBoundingClientRect();

      if (shouldClose) {
        panel!.style.transform = 'translateX(100%)';
        setTimeout(() => { panel!.style.transform = ''; onClose(); }, 310);
      } else {
        panel!.style.transform = 'translateX(0)';
        setTimeout(() => { panel!.style.transform = ''; }, 310);
      }
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const toFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingPct = Math.min(100, (subtotal / freeShippingThreshold) * 100);

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
        aria-label={copy.common.cart}
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.headerTitle}>{copy.cart.title}</h3>
            {itemCount > 0 && (
              <span className={styles.headerCount}>{itemCount} {itemCount === 1 ? copy.cart.item : copy.cart.items}</span>
            )}
          </div>
          <button className={styles.close} onClick={onClose} aria-label={copy.common.close}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Line items ── */}
        <div className={styles.items}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{copy.cart.empty}</p>
              <div className={styles.shopBtnWrap}>
                {/* This used to call onClose alone: the label promised the
                    collection and the button only dismissed the drawer, so
                    from any page that is not the shop it was a dead end
                    wearing a call to action. */}
                <Button variant="secondary" onClick={() => { onClose(); router.push(localeHref(locale, '/shop')); }}>
                  {copy.cart.continueShopping}
                </Button>
              </div>
            </div>
          ) : (
            cart.map((item, index) => {
              const maxQty = Math.min(item.stock ?? 10, 10);
              const atStockLimit = item.stock !== undefined && item.stock < 10 && item.quantity >= maxQty;
              const isBundle = !!item.bundleId;
              return (
                <div key={index} className={styles.item}>
                  {/* Thumbnail — 4:5 portrait */}
                  <div className={styles.itemImg}>
                    <ProductImage src={item.image} alt={item.name} variant="cart" />
                  </div>

                  {/* Info column */}
                  <div className={styles.itemInfo}>
                    <p className={styles.itemName}>{item.name}</p>
                    {isBundle ? (
                      <>
                        <p className={styles.itemDetails}>{copy.cart.bundle}</p>
                        {item.includedProducts && item.includedProducts.length > 0 && (
                          <ul className={styles.bundleList}>
                            {item.includedProducts.map((c, i) => (
                              <li key={i}>{c.name}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className={styles.itemDetails}>
                        {item.colour}{item.size ? ` / ${item.size}` : ''}
                      </p>
                    )}

                    {/* Price row — price left, remove × right */}
                    <div className={styles.itemPriceRow}>
                      <p className={styles.itemPrice}>{format(item.price * item.quantity)}</p>
                      <button
                        className={styles.remove}
                        onClick={() => removeFromCart(index)}
                        aria-label={`${copy.cart.remove}: ${item.name}`}
                      >
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    </div>

                    {atStockLimit && (
                      <p className={styles.stockNote}>{copy.cart.onlyAvailable.replace('{count}', String(item.stock))}</p>
                    )}

                    {/* Quantity stepper */}
                    <div className={styles.stepperWrap}>
                      <button
                        className={styles.stepBtn}
                        onClick={() => updateQuantity(index, -1)}
                        disabled={item.quantity <= 1}
                        aria-label={copy.product.decrease}
                      >−</button>
                      <span className={styles.stepVal}>{item.quantity}</span>
                      <button
                        className={styles.stepBtn}
                        onClick={() => updateQuantity(index, 1)}
                        disabled={item.quantity >= maxQty}
                        aria-label={copy.product.increase}
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
                  {format(toFreeShipping)} {copy.cart.moreForFreeShipping}
                </p>
              </div>
            ) : (
              <p className={styles.freeShippingMet}>{copy.cart.freeShippingUnlocked}</p>
            )}

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>{copy.cart.subtotal}</span>
                <span>{format(subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>{copy.cart.shipping}</span>
                <span className={styles.shippingNote}>{copy.cart.calculatedAtCheckout}</span>
              </div>
              <div className={styles.totalRowFinal}>
                <span>{copy.cart.total}</span>
                <span>{format(subtotal)}</span>
              </div>
            </div>

            {/* "Shipping — calculated at checkout" is the line a UK shopper
                reads as "and customs on top of that". The reassurance existed
                on the product page and at checkout, and not at the one moment
                between them where an unpriced shipping row is staring back. */}
            <div className={styles.ukBadgeRow}><UKShipBadge /></div>

            <Button showArrow onClick={() => { onClose(); router.push(localeHref(locale, '/checkout')); }}>
              {copy.cart.checkout.toUpperCase()}
            </Button>

            <p className={styles.trust}>
              <Lock size={11} strokeWidth={1.5} aria-hidden="true" />
              {copy.cart.secure} · Stripe
            </p>
          </div>
        )}
      </div>
    </>
  );
}
