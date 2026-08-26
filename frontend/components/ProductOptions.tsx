'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useProductSelection } from './ProductSelectionContext';
import DropAHint from './DropAHint';
import { Gift } from '@/components/icons';
import Button from '@/components/ui/Button';
import UKShipBadge from '@/components/UKShipBadge';
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
  sizes: string[];
  productName: string;
  productId: string;
  price: number;
  outOfStock: boolean;
  stock?: number | null;
  /** Sizes with stock. null means the piece has no variant-level tracking, in
   *  which case every size stays selectable. */
  availableSizes?: string[] | null;
  image?: string;
};

export default function ProductOptions({ colours, colourHexMap, sizes, availableSizes = null, productName, productId, price, outOfStock, stock, image }: Props) {
  const { selectedColour, setSelectedColour, selectedSize, setSelectedSize, qty, setQty } = useProductSelection();
  const { format } = useCurrency();
  const freeShippingThreshold = useFreeShippingThreshold();
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

  // ── Back-in-stock waitlist ──
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (notifyState === 'sending') return;
    setNotifyState('sending');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stock-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          email: notifyEmail.trim(),
          size: selectedSize || '',
          colour: selectedColour || '',
        }),
      });
      setNotifyState(res.ok ? 'done' : 'error');
    } catch {
      setNotifyState('error');
    }
  }

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
          shortest path between intent and a captured lead. */}
      {outOfStock && notifyOpen && (
        <div style={{ marginTop: 16 }}>
          {notifyState === 'done' ? (
            <p style={{ fontSize: 13, color: 'var(--color-success)', margin: 0 }}>
              We&rsquo;ll email you the moment it&rsquo;s back.
            </p>
          ) : (
            <form onSubmit={joinWaitlist} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label htmlFor="notifyEmail" className="srOnly">Email address for restock notice</label>
              <input
                id="notifyEmail"
                name="notifyEmail"
                type="email"
                required
                autoComplete="email"
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  flex: '1 1 200px',
                  padding: '12px 14px',
                  border: '1px solid var(--color-line)',
                  background: 'var(--color-bg)',
                  fontFamily: 'inherit',
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                disabled={notifyState === 'sending'}
                style={{
                  padding: '12px 24px',
                  background: 'var(--color-ink)',
                  color: 'var(--color-bg)',
                  border: 'none',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  cursor: notifyState === 'sending' ? 'default' : 'pointer',
                }}
              >
                {notifyState === 'sending' ? 'Adding…' : 'Notify me'}
              </button>
              {notifyState === 'error' && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)', width: '100%', margin: 0 }}>
                  That didn&rsquo;t go through. Please try again.
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* UK shoppers: ships from within the UK, so no customs at the door. */}
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
        <li>From Donegal with love</li>
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
