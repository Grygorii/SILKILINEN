'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useProductSelection } from './ProductSelectionContext';
import { useCart } from '@/context/CartContext';
import Button from '@/components/ui/Button';
import QuickAddSheet from './QuickAddSheet';
import NotifyWhenBack from './NotifyWhenBack';
import type { VariantLike } from '@/lib/variantStock';
import Price from './Price';
import styles from './StickyBuyBar.module.css';
import { localeFromPathname } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';

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
  const locale = localeFromPathname(usePathname());
  const copy = getDictionary(locale);
  const { selectedColour, selectedSize } = useProductSelection();
  const { addToCart } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  // ── When to be here at all ──
  //
  // The bar used to show from the moment the page loaded, so on a short product
  // panel the customer saw ADD TO BAG twice at once: the real button in the
  // page and an identical one pinned below it, with the chat bubble sitting
  // between them. Two identical primary actions on one screen is not twice the
  // encouragement — it is a moment of "which one is the real one", on the one
  // element the whole page exists to get pressed. It also spent ~90px of a
  // phone screen restating a button already in view.
  //
  // So it appears only while the real CTA is NOT on screen. That covers both
  // directions: above the fold on a long page, and scrolled past it.
  // Starts assuming the CTA IS on screen, so the bar is hidden on first paint.
  // The other way round it appeared for one frame on every product page and
  // then slid away — a flash of the exact control this change exists to stop
  // showing twice.
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    // ProductOptions renders this wrapper unconditionally — out of stock it
    // holds "Notify when available" rather than "Add to bag", but it is always
    // there — so there is no real case where the element is missing. If it ever
    // is, the bar simply stays hidden and the customer uses the button in the
    // page, which is the one immediately above where the bar would have been.
    const cta = document.querySelector('[data-add-to-bag]');
    if (!cta) return;
    const io = new IntersectionObserver(
      ([entry]) => setCtaVisible(entry.isIntersecting),
      // A sliver counts as visible; the point is whether she can press it.
      { threshold: 0.35 },
    );
    io.observe(cta);
    return () => io.disconnect();
  }, []);

  const showBar = !ctaVisible;

  // Tag the body only while the bar is actually SHOWING, so the clearance token
  // it drives (--sticky-buy-h, read by the contact bubble) describes what is on
  // screen. Set on mount regardless, it lifted the bubble clear of a bar that
  // was not there.
  useEffect(() => {
    if (!showBar) return;
    document.body.classList.add('has-sticky-buy-bar');
    return () => { document.body.classList.remove('has-sticky-buy-bar'); };
  }, [showBar]);

  const needsColour = colours.length > 0 && !selectedColour;
  const needsSize = sizes.length > 0 && !selectedSize;

  // Choice-free products should add on the first tap. Opening a sheet whose
  // only action is another identical "Add to bag" button makes a simple item
  // take two taps for no customer benefit. Products with real choices still
  // use the sheet so a size/colour and quantity can be confirmed there.
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
    if (colours.length <= 1 && sizes.length <= 1) {
      addToCart({
        productId,
        name: productName,
        price,
        colour: selectedColour,
        size: selectedSize,
        quantity: 1,
        stock: stock ?? undefined,
        image,
      });
      return;
    }
    setSheetOpen(true);
  }

  // The label hints what the sheet will ask for; the button is always active
  // (it was previously greyed out and read as dead when a size was required).
  type CtaVariant = 'primary' | 'secondary' | 'prompt';
  let label: string;
  let variant: CtaVariant;
  if (outOfStock) {
    label = copy.product.notify;
    variant = 'secondary';
  } else if (needsColour) {
    label = copy.product.selectColour;
    variant = 'primary';
  } else if (needsSize) {
    label = copy.product.selectSize;
    variant = 'prompt';
  } else {
    label = copy.product.add;
    variant = 'primary';
  }

  return (
    <>
      {/* Sits directly on top of the bar rather than in a sheet of its own: the
          customer has already said what they want by tapping, and one field
          does not need a modal. */}
      {outOfStock && notifyOpen && showBar && (
        <div className={styles.notifyPanel}>
          <NotifyWhenBack productId={productId} />
        </div>
      )}

      <div className={`${styles.bar} ${showBar ? '' : styles.barHidden}`} aria-hidden={!showBar} inert={!showBar}>
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
