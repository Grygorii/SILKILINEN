'use client';

import { useEffect, useState } from 'react';
import { useProductSelection } from './ProductSelectionContext';
import Button from '@/components/ui/Button';
import QuickAddSheet from './QuickAddSheet';
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
  const { selectedColour, selectedSize } = useProductSelection();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Tag the body while this bar is mounted so global mobile fixed-bottom
  // elements (e.g. ContactWidget chat bubble) can lift themselves clear
  // of the buy bar without taking a direct dependency on this component.
  useEffect(() => {
    document.body.classList.add('has-sticky-buy-bar');
    return () => { document.body.classList.remove('has-sticky-buy-bar'); };
  }, []);

  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;

  // Tapping the bar opens the quick-add sheet (colour + size + quantity), so a
  // size-required product is actionable and any product can have its quantity
  // chosen. Out-of-stock still routes to the notify mailto.
  function handleTap() {
    if (outOfStock) {
      window.location.href = `mailto:hello@silkilinen.com?subject=Notify me: ${encodeURIComponent(productName)}`;
      return;
    }
    setSheetOpen(true);
  }

  // The label hints what the sheet will ask for; the button is always active
  // (it was previously greyed out and read as dead when a size was required).
  type CtaVariant = 'primary' | 'secondary';
  let label: string;
  let variant: CtaVariant;
  if (outOfStock) {
    label = 'NOTIFY';
    variant = 'secondary';
  } else if (needsColour) {
    label = 'CHOOSE COLOUR';
    variant = 'primary';
  } else if (needsSize) {
    label = 'CHOOSE SIZE';
    variant = 'primary';
  } else {
    label = 'ADD TO BAG';
    variant = 'primary';
  }

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.info}>
          <span className={styles.name}>{productName}</span>
          <span className={styles.price}>€{Number(price).toFixed(2)}</span>
        </div>
        <div className={styles.btnWrap}>
          <Button variant={variant} onClick={handleTap}>
            {label}
          </Button>
        </div>
      </div>

      <QuickAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        colours={colours}
        sizes={sizes}
        productName={productName}
        productId={productId}
        price={price}
        stock={stock}
        image={image}
      />
    </>
  );
}
