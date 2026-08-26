'use client';

import { useEffect, useState } from 'react';
import { useProductSelection } from './ProductSelectionContext';
import Button from '@/components/ui/Button';
import QuickAddSheet from './QuickAddSheet';
import NotifyWhenBack from './NotifyWhenBack';
import type { VariantLike } from '@/lib/variantStock';
import Price from './Price';
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
  sizeVariants?: VariantLike[] | null;
};

export default function StickyBuyBar({ productId, productName, price, outOfStock, stock, image, colours, sizes, sizeVariants }: Props) {
  const { selectedColour, selectedSize } = useProductSelection();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

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
  // chosen.
  //
  // Sold out used to send the visitor to a mailto:, which ProductOptions had
  // already replaced on desktop and explained why: with no mail client
  // configured it does nothing at all, and when it does open, the message
  // arrives in an inbox nobody watches for restocks. The waitlist existed, the
  // API existed, and the mobile CTA — the only CTA a phone shows — still could
  // not reach either. It opens the same form now.
  function handleTap() {
    if (outOfStock) {
      setNotifyOpen(v => !v);
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
      {/* Sits directly on top of the bar rather than in a sheet of its own: the
          customer has already said what they want by tapping, and one field
          does not need a modal. */}
      {outOfStock && notifyOpen && (
        <div className={styles.notifyPanel}>
          <NotifyWhenBack productId={productId} />
        </div>
      )}

      <div className={styles.bar}>
        <div className={styles.info}>
          <span className={styles.name}>{productName}</span>
          <Price eur={Number(price)} className={styles.price} />
        </div>
        <div className={styles.btnWrap}>
          <Button
            variant={variant}
            onClick={handleTap}
            aria-expanded={outOfStock ? notifyOpen : undefined}
          >
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
        sizeVariants={sizeVariants}
        image={image}
      />
    </>
  );
}
