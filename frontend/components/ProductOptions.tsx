'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { productHref } from '@/lib/urls';
import type { PageLocale } from '@/lib/i18n';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import DropAHint from './DropAHint';
import { Gift } from '@/components/icons';
import Button from '@/components/ui/Button';
import UKShipBadge from '@/components/UKShipBadge';
import NotifyWhenBack from './NotifyWhenBack';
import { maxOrderable, stockBySize, type VariantLike } from '@/lib/variantStock';
import { OptionPill, OptionPillGroup } from '@/components/ui/OptionPill';
import { ColourSwatchGroup, type Swatch } from '@/components/ui/ColourSwatch';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './ProductOptions.module.css';
import { useFreeShippingThreshold } from '@/lib/useFreeShipping';

type Props = {
  colours: string[];
  // Optional per-variant hex map for the new swatch component.
  // Keys are colour names (lowercased); values are hex strings.
  // If absent, the swatch falls back to the warm-beige placeholder
  // with the colour name centred — the layout never collapses.
  colourHexMap?: Record<string, string>;
  /** The piece's own display colour, e.g. "Sky Blue". */
  colorName?: string | null;
  /** Sibling products that are the same garment in another colour. Choosing
   *  one is NAVIGATION, not a selection — they are separate products with
   *  separate stock, prices and URLs. */
  colorVariants?: { productId: string; colorName: string; slug?: string }[] | null;
  locale?: PageLocale;
  sizes: string[];
  productName: string;
  productId: string;
  price: number;
  outOfStock: boolean;
  stock?: number | null;
  /** Sizes with stock. null means the piece has no variant-level tracking, in
   *  which case every size stays selectable. */
  availableSizes?: string[] | null;
  /** Per-SIZE stock rows. Named sizeVariants, not variants: `colorVariants`
   *  above are sibling PRODUCTS, and this file already binds `variants` to
   *  those. Two different things called variants in one component is how the
   *  colour duplication started. */
  sizeVariants?: VariantLike[] | null;
  /** Free-text fit guidance from the founder, e.g. "Relaxed fit. Size down if
   *  between sizes." Rendered here rather than under the product title: it is
   *  an input to the size decision, and it was unreadable up there — a
   *  two-word note in muted type directly beneath the h1 reads as part of the
   *  name, not as a statement about the cut. */
  fitNote?: string | null;
  image?: string;
};

export default function ProductOptions({ colours, colourHexMap, colorName, colorVariants, locale, sizes, availableSizes = null, sizeVariants, fitNote, productName, productId, price, outOfStock, stock, image }: Props) {
  const { selectedColour, setSelectedColour, selectedSize, setSelectedSize, qty, setQty } = useProductSelection();
  const { format } = useCurrency();
  const freeShippingThreshold = useFreeShippingThreshold();
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [hintOpen, setHintOpen] = useState(false);
  const { addToCart } = useCart();

  // The ceiling for the size actually chosen. Nothing downstream re-checks it:
  // checkoutV2 takes the payment and decrements stock afterwards, fail-soft, so
  // this is the only guard against an order the shop cannot fill.
  const bySize = useMemo(() => stockBySize(sizeVariants), [sizeVariants]);
  const maxQty = maxOrderable(bySize, selectedSize, stock);

  // Switching to a smaller size must bring the quantity down with it, or a
  // basket built as "5 × Large" silently becomes "5 × Medium" with one in stock.
  useEffect(() => {
    if (maxQty > 0 && qty > maxQty) setQty(maxQty);
  }, [maxQty, qty, setQty]);

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

  // ── Back-in-stock waitlist ──
  const [notifyOpen, setNotifyOpen] = useState(false);


  function handleAdd() {
    if (outOfStock) {
      // Was a mailto: link — which on a desktop without a configured mail
      // client does nothing at all, and when it did work sent the request into
      // an inbox where nobody was notified on restock. A customer naming the
      // exact piece they want is the clearest buying signal the shop gets.
      setNotifyOpen(true);
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

  // What to print when there is nothing to choose between: the explicit
  // display colour, else the record's only colour.
  const colourLabel = (colorName ?? '').trim() || (colours.length === 1 ? colours[0] : '');
  const variants = colorVariants ?? [];

  return (
    <div className={styles.root} data-product-options>
      {/* ── Colour ──
          Colour used to be stated TWICE on this page: a "COLOUR" cube row up
          under the product name, and this labelled swatch group down here. Two
          blocks, same heading, ~200px apart, and in the ordinary case the
          second one was a picker offering exactly one option — the same fault
          as the single-size pill, which had already been fixed for size and
          not for colour.

          They exist because there are two different things called colour. The
          record's own `colours` array is a CHOICE that goes into the cart line.
          `colorVariants` are separate PRODUCTS — same garment, another colour,
          own stock and own URL — so picking one is navigation. Both are real;
          neither needed its own heading.

          One block now, and it sits after the material rather than above the
          price, which is the order §22 asks for. */}
      {(colourLabel || swatches.length > 1 || variants.length > 0) && (
        <div className={styles.picker}>
          {swatches.length > 1 ? (
            <ColourSwatchGroup
              swatches={swatches}
              selectedName={selectedColour || undefined}
              onSelect={setSelectedColour}
            />
          ) : colourLabel && (
            // One colour is a fact about the garment, not a decision. Same row
            // shape as size and fit, so the three read as one list.
            <p className={styles.factRow}>
              <span className={styles.pickerLabel}>Colour</span>
              <span className={styles.factSep} aria-hidden="true">·</span>
              <span className={styles.factValue}>{colourLabel}</span>
            </p>
          )}

          {variants.length > 0 && (
            <div className={styles.variantRow}>
              {variants.map(v => (
                <Link
                  key={v.productId}
                  // Canonical by construction — the API serves each sibling's
                  // slug and productHref always prefers it over the ObjectId.
                  href={productHref({ slug: v.slug, _id: v.productId }, locale)}
                  className={styles.variantLink}
                >
                  {v.colorName}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fit — read BEFORE the size is chosen, which is the only moment
          "size down if between sizes" can still change anything. Labelled for
          the same reason it moved: the field holds anything from two words to
          three sentences, and an unlabelled fragment is just a fragment. */}
      {fitNote && fitNote.trim() && (
        <div className={styles.picker}>
          <p className={`${styles.factRow} ${styles.fitRow}`}>
            <span className={styles.pickerLabel}>Fit</span>
            <span className={styles.factSep} aria-hidden="true">·</span>
            <span className={styles.fitValue}>{fitNote.trim()}</span>
          </p>
        </div>
      )}

      {/* Size — design-system v1 OptionPill grid + sizing chart footnote */}
      {/* One size is not a CHOICE — it is a fact about the garment.
          Rendered as a pill it stretched to the full row (auto-fit + 1fr with a
          single column), auto-selected to solid ink, and became a second
          full-width dark bar sitting directly above ADD TO BAG. Two identical
          slabs, one of which must not be pressed: people click the wrong one.
          Say it in a line of text instead. */}
      {/* One line, not three. The previous fix correctly stopped rendering a
          single size as a pressable pill; it still kept the label row, the
          chart link and the value on separate lines, so a fact about the
          garment occupied as much of the page as a decision.
          This matches the shape the COLOUR row already uses — "COLOUR ·
          Emerald Green" — so size reads as the same kind of statement rather
          than as a picker with one option. */}
      {sizes.length === 1 && (
        <div className={styles.picker}>
          <p className={styles.factRow}>
            <span className={styles.pickerLabel}>Size</span>
            <span className={styles.factSep} aria-hidden="true">·</span>
            <span className={styles.factValue}>{sizes[0]}</span>
            <a
              href="/size-guide"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sizeGuideLink}
            >
              Sizing chart
            </a>
          </p>
        </div>
      )}

      {sizes.length > 1 && (
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
            {sizes.map(size => {
              const soldOut = availableSizes !== null && !availableSizes.includes(size);
              return (
                <OptionPill
                  key={size}
                  selected={selectedSize === size}
                  disabled={soldOut}
                  onSelect={() => { if (!soldOut) setSelectedSize(size); }}
                  // Say WHY it cannot be chosen — a pill that simply does not
                  // respond reads as a broken page.
                  ariaLabel={soldOut ? `Size ${size} — sold out` : `Size ${size}`}
                >
                  {size}
                </OptionPill>
              );
            })}
          </OptionPillGroup>
        </div>
      )}

      {/* Quantity stepper — keep existing styling for now; not in
          the four-primitive set defined by v1 */}
      {/* Quantity is optional; size and colour are required. Giving all three
          the same visual rank put an untouched control directly above ADD TO
          BAG — §27's "quantity must not compete with Add to Bag".
          NOT removed: bridesmaid robes and eye masks for a wedding party are a
          real multi-buy, and the Bridal Edit depends on it. Demoted to one
          row, the same shape as the size fact above it. */}
      {!outOfStock && (
        <div className={`${styles.stepper} ${styles.factRow}`}>
          <span className={styles.pickerLabel}>Quantity</span>
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
      <div className={styles.ctaWrap}>
        <Button
          variant={ctaVariant}
          onClick={handleAdd}
          aria-disabled={ctaVariant === 'disabled' || addState === 'adding'}
        >
          {ctaLabel}
        </Button>
      </div>

      {/* Back-in-stock waitlist — replaces the mailto: that quietly did nothing.
          Rendered inline rather than as a modal: the customer already told us
          what they want by clicking, so asking for one field in place is the
          shortest path between intent and a captured lead.
          The form itself lives in NotifyWhenBack, because the mobile sticky bar
          needs the same one and had been left on the old mailto. */}
      {outOfStock && notifyOpen && (
        <div className={styles.notifyWrap}>
          <NotifyWhenBack productId={productId} />
        </div>
      )}

      {/* UK shoppers: dispatched from Derry, so nothing to pay at the border. */}
      <UKShipBadge />

      {/* Trust row — the reassurance a considered buyer wants right at the
          add-to-bag moment (was only on the homepage / hidden in accordions). */}
      <ul
        style={{
          listStyle: 'none', margin: '14px 0 0', padding: 0,
          display: 'flex', flexWrap: 'wrap', gap: '6px 18px',
          fontSize: 12, lineHeight: 1.6, color: 'var(--color-ink-muted)',
        }}
      >
        <li>Free shipping over {format(freeShippingThreshold)}</li>
        <li>14-day returns</li>
        <li>Secure checkout</li>
        {/* §29's fourth line. It read "From Donegal with love" — the only item
            in a list of operational promises that was a slogan rather than
            something a customer can hold the shop to, and the only one that
            hints at where the piece was made in a list about how it is sent.
            Gift-ready packaging is a claim the shop already makes on
            /gift-wrapping, in the FAQ, in the accordion below and in the
            homepage reassurance row: tissue-lined box and ribbon, included.
            §22's "gift wrapping available" is the wrong wording for it —
            "available" implies an extra to select, and there is nothing to
            select because every order gets it. */}
        <li>Gift-ready packaging</li>
      </ul>

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
