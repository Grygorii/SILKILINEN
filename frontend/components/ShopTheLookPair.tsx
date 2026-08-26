'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { productPath } from '@/lib/urls';
import { cloudinaryUrl } from '@/lib/imageUtils';
import Price from './Price';
import styles from './ShopTheLook.module.css';

type Piece = {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  colours?: string[];
  sizes?: string[];
  images?: { url: string; isPrimary?: boolean }[];
  image?: string;
  totalStock?: number;
};

function imageOf(p: Piece) {
  return p.images?.find(i => i.isPrimary)?.url || p.images?.[0]?.url || p.image;
}

export default function ShopTheLookPair({ anchor, companion }: { anchor: Piece; companion: Piece }) {
  const { cart, addToCart } = useCart();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const total = Number(anchor.price) + Number(companion.price);

  function addBoth() {
    setAdding(true);
    for (const p of [anchor, companion]) {
      const colour = p.colours?.length === 1 ? p.colours[0] : '';
      const size = p.sizes?.length === 1 ? p.sizes[0] : '';
      // Idempotent, the same rule the collection set uses: a look means one of
      // each. Re-clicking must not stack quantities, and a piece the shopper
      // already added earlier is left exactly as they set it.
      const already = cart.some(c => c.productId === p._id && (c.colour || '') === colour && (c.size || '') === size);
      if (already) continue;
      addToCart({
        productId: p._id,
        name: p.name,
        price: p.price,
        colour,
        size,
        quantity: 1,
        stock: p.totalStock,
        image: imageOf(p),
      });
    }
    router.push('/checkout');
  }

  return (
    <section className={styles.section} aria-labelledby="pairs-with">
      <h2 id="pairs-with" className={styles.heading}>Pairs with</h2>

      <div className={styles.pair}>
        {[anchor, companion].map((p, i) => {
          const img = imageOf(p);
          return (
            <div key={p._id} className={styles.piece}>
              {/* The anchor is the page you are on, so it is not a link — a
                  link to here is a dead end that costs a page load. */}
              {i === 0 ? (
                <span className={styles.imgWrap}>
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cloudinaryUrl(img, 320)} alt="" className={styles.img} loading="lazy" />
                  )}
                </span>
              ) : (
                <Link href={productPath(p)} className={styles.imgWrap}>
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cloudinaryUrl(img, 320)} alt={p.name} className={styles.img} loading="lazy" />
                  )}
                </Link>
              )}
              <p className={styles.name}>
                {i === 0 ? p.name : <Link href={productPath(p)} className={styles.nameLink}>{p.name}</Link>}
              </p>
              <p className={styles.price}><Price eur={Number(p.price)} /></p>
            </div>
          );
        })}
      </div>

      <div className={styles.action}>
        <p className={styles.total}>
          <span className={styles.totalLabel}>Both</span>
          <Price eur={total} />
        </p>
        <button type="button" className={styles.cta} onClick={addBoth} disabled={adding}>
          {adding ? 'Adding…' : 'Add both to bag'}
        </button>
      </div>
      {/* No discount claimed. The collection sets price a real one at checkout;
          inventing a saving here would be a price claim we do not honour. */}
    </section>
  );
}
