'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import Button from '@/components/ui/Button';
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

  // Tag the body while this bar is mounted so global mobile fixed-bottom
  // elements (e.g. ContactWidget chat bubble) can lift themselves clear
  // of the buy bar without taking a direct dependency on this component.
  useEffect(() => {
    document.body.classList.add('has-sticky-buy-bar');
    return () => { document.body.classList.remove('has-sticky-buy-bar'); };
  }, []);

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

  // Design-system v1: skin the button via the shared primitive. Outline
  // when out-of-stock so it reads as a secondary action; disabled when
  // a selection is missing.
  type CtaVariant = 'primary' | 'secondary' | 'disabled';
  let label: string;
  let variant: CtaVariant;
  if (outOfStock) {
    label = 'NOTIFY';
    variant = 'secondary';
  } else if (addState === 'adding') {
    label = 'ADDING…';
    variant = 'primary';
  } else if (addState === 'added') {
    label = 'ADDED ✓';
    variant = 'primary';
  } else if (needsColour) {
    label = 'CHOOSE COLOUR';
    variant = 'disabled';
  } else if (needsSize) {
    label = 'CHOOSE SIZE';
    variant = 'disabled';
  } else {
    label = 'ADD TO BAG';
    variant = 'primary';
  }

  return (
    <div className={styles.bar}>
      <div className={styles.info}>
        <span className={styles.name}>{productName}</span>
        <span className={styles.price}>€{Number(price).toFixed(2)}</span>
      </div>
      <div className={styles.btnWrap}>
        <Button variant={variant} onClick={handleAdd}>
          {label}
        </Button>
      </div>
    </div>
  );
}
