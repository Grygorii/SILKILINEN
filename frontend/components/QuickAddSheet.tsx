'use client';

import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import Button from '@/components/ui/Button';
import { OptionPill, OptionPillGroup } from '@/components/ui/OptionPill';
import { ColourSwatchGroup, type Swatch } from '@/components/ui/ColourSwatch';
import styles from './QuickAddSheet.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  colours: string[];
  colourHexMap?: Record<string, string>;
  sizes: string[];
  productName: string;
  productId: string;
  price: number;
  stock?: number | null;
  image?: string;
};

// Mobile "quick add" bottom sheet opened from the sticky buy bar. Lets the
// shopper choose colour + size + quantity and add to bag without scrolling
// away. Shares ProductSelectionContext with the inline picker, so selections
// stay in sync.
export default function QuickAddSheet({
  open, onClose, colours, colourHexMap, sizes, productName, productId, price, stock, image,
}: Props) {
  const { selectedColour, setSelectedColour, selectedSize, setSelectedSize, qty, setQty } = useProductSelection();
  const { addToCart } = useCart();

  const maxQty = Math.min(stock ?? 10, 10);
  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;
  const canAdd = !needsColour && !needsSize;

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const swatches: Swatch[] = colours.map(name => ({ name, hex: colourHexMap?.[name.toLowerCase()] ?? null }));

  function handleAdd() {
    if (!canAdd) return;
    addToCart({ productId, name: productName, price, colour: selectedColour, size: selectedSize, quantity: qty, stock: stock ?? undefined, image });
    onClose();
  }

  const ctaLabel = needsColour ? 'SELECT A COLOUR' : needsSize ? 'SELECT A SIZE' : 'ADD TO BAG';

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`Add ${productName} to bag`}>
        <div className={styles.handle} aria-hidden="true" />

        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.name}>{productName}</p>
            <p className={styles.price}>€{Number(price).toFixed(2)}</p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {colours.length > 0 && (
          <div className={styles.section}>
            <ColourSwatchGroup swatches={swatches} selectedName={selectedColour || undefined} onSelect={setSelectedColour} />
          </div>
        )}

        {sizes.length > 0 && (
          <div className={styles.section}>
            <div className={styles.rowLabel}>
              <span className={styles.label}>SIZE</span>
              <a href="/size-guide" target="_blank" rel="noopener noreferrer" className={styles.sizeGuide}>SIZING CHART</a>
            </div>
            <OptionPillGroup ariaLabel="Size">
              {sizes.map(size => (
                <OptionPill key={size} selected={selectedSize === size} onSelect={() => setSelectedSize(size)} ariaLabel={`Size ${size}`}>
                  {size}
                </OptionPill>
              ))}
            </OptionPillGroup>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.rowLabel}>
            <span className={styles.label}>QUANTITY</span>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">−</button>
              <span className={styles.qtyVal}>{qty}</span>
              <button className={styles.stepBtn} onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">+</button>
            </div>
          </div>
        </div>

        <div className={styles.cta}>
          <Button variant={canAdd ? 'primary' : 'disabled'} onClick={handleAdd} aria-disabled={!canAdd}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
