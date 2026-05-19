'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import styles from './StickyBuyBar.module.css';

type Props = {
  productId: string;
  productName: string;
  price: number;
  outOfStock: boolean;
  stock?: number | null;
  image?: string;
  colours: string[];
  sizes: string[];
};

export default function StickyBuyBar({ productId, productName, price, outOfStock, stock, image, colours, sizes }: Props) {
  const { selectedColour, selectedSize, qty } = useProductSelection();
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const { addToCart } = useCart();

  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;

  function handleAdd() {
    if (outOfStock) {
      window.location.href = `mailto:hello@silkilinen.com?subject=Notify me: ${encodeURIComponent(productName)}`;
      return;
    }
    if (needsColour || needsSize) {
      document.querySelector('[data-product-options]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (addState !== 'idle') return;
    setAddState('adding');
    setTimeout(() => {
      addToCart({ productId, name: productName, price, colour: selectedColour, size: selectedSize, quantity: qty, stock: stock ?? undefined, image });
      setAddState('added');
      setTimeout(() => setAddState('idle'), 3000);
    }, 400);
  }

  let label: string;
  if (outOfStock) label = 'OUT OF STOCK';
  else if (addState === 'adding') label = 'ADDING…';
  else if (addState === 'added') label = 'ADDED ✓';
  else if (needsColour) label = 'Choose colour';
  else if (needsSize) label = 'Choose size';
  else label = 'ADD TO BAG';

  return (
    <div className={styles.bar}>
      <div className={styles.info}>
        <span className={styles.name}>{productName}</span>
        <span className={styles.price}>€{Number(price).toFixed(2)}</span>
      </div>
      <button
        className={`${styles.btn} ${outOfStock ? styles.btnOut : ''} ${addState === 'added' ? styles.btnAdded : ''}`}
        onClick={handleAdd}
        disabled={addState === 'adding'}
      >
        {label}
      </button>
    </div>
  );
}
