'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { colourToHex } from '@/lib/colours';
import DropAHint from './DropAHint';
import styles from './ProductOptions.module.css';

type Props = {
  colours: string[];
  sizes: string[];
  productName: string;
  productId: string;
  price: number;
  outOfStock: boolean;
  stock?: number | null;
};

export default function ProductOptions({ colours, sizes, productName, productId, price, outOfStock, stock }: Props) {
  const [selectedColour, setSelectedColour] = useState(colours[0] ?? '');
  const [selectedSize, setSelectedSize] = useState(() => sizes.length === 1 ? sizes[0] : '');
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [hintOpen, setHintOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();

  const maxQty = Math.min(stock ?? 10, 10);

  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;
  const canAdd = !outOfStock && !needsColour && !needsSize;

  let ctaLabel: string;
  let ctaDisabled: boolean;
  let ctaOutline = false;

  if (outOfStock) {
    ctaLabel = 'NOTIFY WHEN AVAILABLE';
    ctaDisabled = false;
    ctaOutline = true;
  } else if (addState === 'adding') {
    ctaLabel = 'ADDING…';
    ctaDisabled = true;
  } else if (addState === 'added') {
    ctaLabel = 'ADDED TO BAG ✓';
    ctaDisabled = false;
  } else if (needsColour) {
    ctaLabel = 'PLEASE SELECT A COLOUR';
    ctaDisabled = true;
  } else if (needsSize) {
    ctaLabel = 'PLEASE SELECT A SIZE';
    ctaDisabled = true;
  } else {
    ctaLabel = 'ADD TO BAG';
    ctaDisabled = false;
  }

  function handleAdd() {
    if (outOfStock) {
      window.location.href = `mailto:hello@silkilinen.com?subject=Notify me: ${encodeURIComponent(productName)}`;
      return;
    }
    if (!canAdd || addState !== 'idle') return;
    setAddState('adding');
    setTimeout(() => {
      addToCart({ productId, name: productName, price, colour: selectedColour, size: selectedSize, quantity: qty, stock: stock ?? undefined });
      setAddState('added');
      setTimeout(() => setAddState('idle'), 3000);
    }, 400);
  }

  return (
    <div className={styles.root}>
      {/* Colour */}
      {colours.length > 0 && (
        <div className={styles.picker}>
          <p className={styles.pickerLabel}>
            COLOUR:{' '}
            <span className={styles.pickerValue}>{selectedColour || '—'}</span>
          </p>
          <div className={styles.swatches}>
            {colours.map(colour => {
              const hex = colourToHex(colour);
              return (
                <button
                  key={colour}
                  className={`${styles.swatch} ${selectedColour === colour ? styles.swatchActive : ''}`}
                  onClick={() => setSelectedColour(colour)}
                  title={colour}
                  aria-label={colour}
                  aria-pressed={selectedColour === colour}
                  style={hex ? { background: hex } : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Size */}
      {sizes.length > 0 && (
        <div className={styles.picker}>
          <p className={styles.pickerLabel}>
            <span>SIZE</span>
            <a href="/size-guide" target="_blank" rel="noopener noreferrer" className={styles.sizeGuideLink}>
              SIZING CHART
            </a>
          </p>
          <div className={styles.sizes}>
            {sizes.map(size => (
              <button
                key={size}
                className={`${styles.sizeBtn} ${selectedSize === size ? styles.sizeBtnActive : ''}`}
                onClick={() => setSelectedSize(size)}
                aria-pressed={selectedSize === size}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity stepper */}
      {!outOfStock && (
        <div className={styles.stepper}>
          <p className={styles.stepperLabel}>QUANTITY</p>
          <div className={styles.stepperControls}>
            <button
              className={styles.stepperBtn}
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >−</button>
            <span className={styles.stepperVal}>{qty}</span>
            <button
              className={styles.stepperBtn}
              onClick={() => setQty(q => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              aria-label="Increase quantity"
            >+</button>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className={`${styles.cta} ${ctaOutline ? styles.ctaOutline : ''} ${addState === 'added' ? styles.ctaAdded : ''}`}
        onClick={handleAdd}
        disabled={ctaDisabled}
      >
        {ctaLabel}
      </button>

      {/* Drop a Hint */}
      <button className={styles.hintBtn} onClick={() => setHintOpen(true)}>
        🎁&nbsp; DROP A HINT
      </button>

      {hintOpen && (
        <DropAHint productId={productId} productName={productName} onClose={() => setHintOpen(false)} />
      )}
    </div>
  );
}
