'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import ProductImage from '@/components/products/ProductImage';
import styles from './CollectionSet.module.css';

type SetProduct = {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  colours?: string[];
  sizes?: string[];
  // In-stock subset of colours/sizes, computed server-side. Sold-out options
  // stay visible but are disabled, so a buyer can't add an unfulfillable line.
  availableSizes?: string[];
  availableColours?: string[];
  images?: { url: string; isPrimary?: boolean; alt?: string }[];
  image?: string;
  totalStock?: number;
  inStock?: boolean;
};

type Item = { p: SetProduct; sizes: string[]; colours: string[]; liveSizes: Set<string>; liveColours: Set<string>; soldOut: boolean };

// "Shop the set" view for a collection: every product as photo + name + price
// with inline size/colour pickers, and one button that drops the whole (in-stock)
// set in the bag and goes straight to checkout. The collection's % discount is
// applied automatically server-side at checkout, so there's nothing to do here
// but show the saving.
export default function CollectionSet({
  products, discountPercent = 0,
}: { products: SetProduct[]; discountPercent?: number }) {
  const router = useRouter();
  const { cart, addToCart } = useCart();
  const { format } = useCurrency();
  const [adding, setAdding] = useState(false);
  const [size, setSize] = useState<Record<string, string>>({});
  const [colour, setColour] = useState<Record<string, string>>({});

  const items: Item[] = useMemo(() => products.map(p => ({
    p,
    sizes: (p.sizes ?? []).map(s => String(s).trim()).filter(Boolean),
    colours: (p.colours ?? []).map(c => String(c).trim()).filter(Boolean),
    liveSizes: new Set((p.availableSizes ?? p.sizes ?? []).map(s => String(s).trim())),
    liveColours: new Set((p.availableColours ?? p.colours ?? []).map(c => String(c).trim())),
    soldOut: p.inStock === false || p.totalStock === 0,
  })), [products]);

  const available = items.filter(i => !i.soldOut);

  // A choice is only required when there's more than one option; a single (or no)
  // option auto-resolves to that value (or '').
  const sizeOf = (i: Item) => i.sizes.length <= 1 ? (i.sizes[0] ?? '') : size[i.p._id];
  const colourOf = (i: Item) => i.colours.length <= 1 ? (i.colours[0] ?? '') : colour[i.p._id];

  const unset = available.filter(i =>
    (i.sizes.length > 1 && !size[i.p._id]) || (i.colours.length > 1 && !colour[i.p._id]),
  );
  const ready = available.length > 0 && unset.length === 0;

  const subtotal = available.reduce((s, i) => s + i.p.price, 0);
  const saving = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const total = Math.round((subtotal - saving) * 100) / 100;

  function addSet() {
    if (!ready || adding) return;
    setAdding(true);
    for (const i of available) {
      const colour = colourOf(i) ?? '';
      const size = sizeOf(i) ?? '';
      // Idempotent: "the set" means one of each piece. If a piece is already in
      // the bag (re-click, or the shopper added it earlier), leave it as-is
      // rather than incrementing — otherwise quantities balloon on every click.
      const already = cart.some(c => c.productId === i.p._id && (c.colour || '') === colour && (c.size || '') === size);
      if (already) continue;
      const primary = i.p.images?.find(im => im.isPrimary) ?? i.p.images?.[0];
      addToCart({
        productId: i.p._id,
        name: i.p.name,
        price: i.p.price,
        colour,
        size,
        quantity: 1,
        stock: i.p.totalStock,
        image: primary?.url ?? i.p.image,
      });
    }
    router.push('/checkout');
  }

  const allSoldOut = available.length === 0;
  const ctaLabel = allSoldOut
    ? 'Sold out'
    : adding
      ? 'Adding…'
      : ready
        ? 'Add the set to bag'
        : `Select ${unset.length} option${unset.length > 1 ? 's' : ''} to continue`;

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {items.map(({ p, sizes, colours, liveSizes, liveColours, soldOut }) => {
          const href = `/product/${p.slug || p._id}`;
          return (
            <div key={p._id} className={`${styles.card} ${soldOut ? styles.soldOutCard : ''}`}>
              <Link href={href} className={styles.imgLink} aria-label={p.name}>
                <ProductImage images={p.images} src={p.image} alt={p.name} variant="card" wrapClassName={styles.img} />
                {soldOut && <span className={styles.soldOut}>Sold out</span>}
              </Link>
              <Link href={href} className={styles.name}>{p.name}</Link>
              <p className={styles.price}>{format(Number(p.price))}</p>

              {!soldOut && colours.length > 1 && (
                <div className={styles.opts} role="group" aria-label={`Colour for ${p.name}`}>
                  {colours.map(c => {
                    const gone = !liveColours.has(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={gone}
                        title={gone ? 'Sold out' : undefined}
                        className={`${styles.opt} ${colour[p._id] === c ? styles.optOn : ''} ${gone ? styles.optGone : ''}`}
                        onClick={() => setColour(prev => ({ ...prev, [p._id]: c }))}
                      >{c}</button>
                    );
                  })}
                </div>
              )}

              {!soldOut && sizes.length > 1 && (
                <div className={styles.opts} role="group" aria-label={`Size for ${p.name}`}>
                  {sizes.map(s => {
                    const gone = !liveSizes.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={gone}
                        title={gone ? 'Sold out' : undefined}
                        className={`${styles.opt} ${size[p._id] === s ? styles.optOn : ''} ${gone ? styles.optGone : ''}`}
                        onClick={() => setSize(prev => ({ ...prev, [p._id]: s }))}
                      >{s}</button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.bar}>
        {!allSoldOut && (
          <div className={styles.totals}>
            {discountPercent > 0 ? (
              <>
                <span className={styles.was}>{format(subtotal)}</span>
                <span className={styles.now}>{format(total)}</span>
                <span className={styles.off}>{discountPercent}% off applied at checkout</span>
              </>
            ) : (
              <span className={styles.now}>{format(subtotal)}</span>
            )}
          </div>
        )}
        <button type="button" className={styles.cta} onClick={addSet} disabled={!ready || adding}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
