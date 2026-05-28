'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import DropAHint from './DropAHint';
import { Gift } from '@/components/icons';
import Button from '@/components/ui/Button';
import { OptionPill, OptionPillGroup } from '@/components/ui/OptionPill';
import { ColourSwatchGroup, type Swatch } from '@/components/ui/ColourSwatch';
import styles from './ProductOptions.module.css';

type Props = {
  colours: string[];
  // Optional per-variant hex map for the new swatch component.
  // Keys are colour names (lowercased); values are hex strings.
  // If absent, the swatch falls back to the warm-beige placeholder
  // with the colour name centred — the layout never collapses.
  colourHexMap?: Record<string, string>;
  sizes: string[];
  productName: string;
  productId: string;
  price: number;
  outOfStock: boolean;
  stock?: number | null;
  image?: string;
};

export default function ProductOptions({ colours, colourHexMap, sizes, productName, productId, price, outOfStock, stock, image }: Props) {
  const { selectedColour, setSelectedColour, selectedSize, setSelectedSize, qty, setQty } = useProductSelection();
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [hintOpen, setHintOpen] = useState(false);
  const { addToCart } = useCart();

  const maxQty = Math.min(stock ?? 10, 10);

  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;
  const canAdd = !outOfStock && !needsColour && !needsSize;

  // CTA variant + label resolution (design-system v1):
  //   - out of stock → secondary "Notify when available"
  //   - mid-add      → primary disabled "Adding…"
  //   - just added   → primary "Added to bag ✓"
  //   - needs choice → disabled primary "Select a colour / size"
  //   - default      → primary "Add to bag"
  type CtaVariant = 'primary' | 'secondary' | 'disabled';
  let ctaLabel: string;
  let ctaVariant: CtaVariant;
  if (outOfStock) {
    ctaLabel = 'NOTIFY WHEN AVAILABLE';
    ctaVariant = 'secondary';
  } else if (addState === 'adding') {
    ctaLabel = 'ADDING…';
    ctaVariant = 'primary';
  } else if (addState === 'added') {
    ctaLabel = 'ADDED TO BAG ✓';
    ctaVariant = 'primary';
  } else if (needsColour) {
    ctaLabel = 'SELECT A COLOUR';
    ctaVariant = 'disabled';
  } else if (needsSize) {
    ctaLabel = 'SELECT A SIZE';
    ctaVariant = 'disabled';
  } else {
    ctaLabel = 'ADD TO BAG';
    ctaVariant = 'primary';
  }

  function handleAdd() {
    if (outOfStock) {
      window.location.href = `mailto:hello@silkilinen.com?subject=Notify me: ${encodeURIComponent(productName)}`;
      return;
    }
    if (!canAdd || addState !== 'idle') return;
    setAddState('adding');
    setTimeout(() => {
      addToCart({ productId, name: productName, price, colour: selectedColour, size: selectedSize, quantity: qty, stock: stock ?? undefined, image });
      setAddState('added');
      setTimeout(() => setAddState('idle'), 3000);
    }, 400);
  }

  // Build the swatch list. Per-variant hex isn't stored on the variant
  // subdocument today, so we look up by colour name via an optional map.
  // Sold-out detection for individual colours is out of scope here (the
  // whole product is either in stock or not via outOfStock).
  const swatches: Swatch[] = colours.map(name => ({
    name,
    hex: colourHexMap?.[name.toLowerCase()] ?? null,
  }));

  return (
    <div className={styles.root} data-product-options>
      {/* Colour — design-system v1 labelled swatch */}
      {colours.length > 0 && (
        <div className={styles.picker}>
          <ColourSwatchGroup
            swatches={swatches}
            selectedName={selectedColour || undefined}
            onSelect={setSelectedColour}
          />
        </div>
      )}

      {/* Size — design-system v1 OptionPill grid + sizing chart footnote */}
      {sizes.length > 0 && (
        <div className={styles.picker}>
          <p className={styles.sizeRow}>
            <span className={styles.pickerLabel}>SIZE</span>
            <a
              href="/size-guide"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sizeGuideLink}
            >
              SIZING CHART
            </a>
          </p>
          <OptionPillGroup ariaLabel="Size">
            {sizes.map(size => (
              <OptionPill
                key={size}
                selected={selectedSize === size}
                onSelect={() => setSelectedSize(size)}
                ariaLabel={`Size ${size}`}
              >
                {size}
              </OptionPill>
            ))}
          </OptionPillGroup>
        </div>
      )}

      {/* Quantity stepper — keep existing styling for now; not in
          the four-primitive set defined by v1 */}
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
      <div className={`${styles.ctaWrap} ${addState === 'added' ? styles.ctaWrapBreathing : ''}`}>
        <Button
          variant={ctaVariant}
          onClick={handleAdd}
          aria-disabled={ctaVariant === 'disabled' || addState === 'adding'}
        >
          {ctaLabel}
        </Button>
      </div>

      {/* Drop a Hint — quiet uppercase link with a hairline gift glyph,
          sits at the foot of the panel by design proposal. */}
      <button className={styles.hintBtn} onClick={() => setHintOpen(true)}>
        <Gift size={16} />&nbsp; DROP A HINT
      </button>

      {hintOpen && (
        <DropAHint productId={productId} productName={productName} onClose={() => setHintOpen(false)} />
      )}
    </div>
  );
}
