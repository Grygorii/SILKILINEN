'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
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
import { detailRows } from '@/lib/productDetails';
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

  const variants = colorVariants ?? [];

  const variantLinks = variants.length > 0 ? (
    <div className={styles.variantRow}>
      {variants.map(v => (
        <Link
          key={v.productId}
          // Canonical by construction — the API serves each sibling's slug and
          // productHref always prefers it over the ObjectId.
          href={productHref({ slug: v.slug, _id: v.productId }, locale)}
          className={styles.variantLink}
        >
          {v.colorName}
        </Link>
      ))}
    </div>
  ) : null;

  // The facts, in §22's order — the rule lives in lib/productDetails.ts so that
  // "a choice never appears as a fact, and nothing is stated twice" is pinned
  // rather than re-derived. The sizing-chart link is attached here because it
  // is markup, not part of the rule.
  const details = detailRows({ colours, colorName, fitNote, sizes }).map(row => (
    row.key === 'size'
      ? {
          ...row,
          // The chart belongs beside a size the customer cannot change:
          // "one size" is exactly when she wants to know what one size means.
          aside: (
            <a
              href="/size-guide"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sizeGuideLink}
            >
              Sizing chart
            </a>
          ),
        }
      : row
  )) as { key: string; label: string; value: string; aside?: React.ReactNode }[];

  return (
    <div className={styles.root} data-product-options>
      {/* ── Colour: a real choice keeps its own block ──
          Colour used to be stated TWICE on this page — a "COLOUR" cube row up
          under the product name AND a labelled swatch group down here. Two
          different things are called colour: the record's `colours` array is a
          CHOICE that goes in the cart line, while `colorVariants` are separate
          PRODUCTS with their own stock and URL, so picking one is navigation.
          Both are real; neither needed its own heading.

          More than one colour is a decision and gets swatches. Exactly one is a
          FACT, and facts belong in the details grid below. */}
      {swatches.length > 1 && (
        <div className={styles.picker}>
          <ColourSwatchGroup
            swatches={swatches}
            selectedName={selectedColour || undefined}
            onSelect={setSelectedColour}
          />
          {variantLinks}
        </div>
      )}

      {/* ── The details grid: everything that is NOT a decision ──
          These were three separate rows — COLOUR, FIT, SIZE — each padded to a
          44px control height with 24px between them, because each was fixed on
          its own and each fix was right on its own. On a one-size, one-colour
          piece they all degrade to facts at once, and the result was four
          identical label-and-value bars stacked in a column with nothing to
          choose in any of them: a form with nothing to fill in, spending ~200px
          and four separate glances to say three short things.

          One grid instead. Labels align to one column and values to another, so
          the eye reads down rather than hopping; rows are as tall as their text
          rather than as tall as a button. The "·" separators are gone — once
          the columns line up, the dot only adds a mark to a page that needed
          fewer of them. */}
      {details.length > 0 && (
        <dl className={styles.details}>
          {details.map(d => (
            <Fragment key={d.key}>
              <dt className={styles.detailLabel}>{d.label}</dt>
              <dd className={styles.detailValue}>
                <span>{d.value}</span>
                {d.aside}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}

      {/* Sibling colour products, when there was no swatch block to carry them. */}
      {swatches.length <= 1 && variantLinks}

      {/* Size — a genuine choice: the OptionPill grid, with the chart footnote.
          A SINGLE size is not a choice and is not rendered here; it is a row in
          the details grid above. Rendered as a pill it stretched to the full
          row and auto-selected to solid ink, becoming a second full-width dark
          bar directly above ADD TO BAG — two identical slabs, one of which must
          not be pressed. */}
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
        <div className={styles.stepper}>
          <span className={styles.detailLabel}>Quantity</span>
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
      {/* Tagged so StickyBuyBar can tell whether the real button is on screen
          — see the observer there. */}
      <div className={styles.ctaWrap} data-add-to-bag>
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
