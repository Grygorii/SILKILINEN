'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { isValidImageUrl } from '@/lib/imageUtils';
import ProductImage from './products/ProductImage';
import styles from './ProductCard.module.css';

type ProductImageData = { url: string; isPrimary?: boolean; alt?: string; order?: number };

export type ProductCardData = {
  _id: string;
  name: string;
  price: number;
  materialComposition?: string;
  createdAt?: string;
  isNewArrival?: boolean;
  /** Legacy flag name — accepted as a fallback for un-migrated products. */
  isNew?: boolean;
  sizes?: string[];
  colours?: string[];
  images?: ProductImageData[];
  image?: string;
};

type Props = {
  product: ProductCardData;
  /** Show the wishlist heart top-right. Default true. */
  showHeart?: boolean;
};

/**
 * Canonical product card used everywhere products are shown on the
 * storefront — shop grid, new arrivals, recently viewed, cross-sell,
 * wishlist, and bundle children.
 *
 * The whole card is one click target: the product name is a real anchor
 * whose `::after` is stretched over the entire card (see .nameLink in the
 * CSS module), so a click anywhere navigates to the PDP — except the
 * wishlist heart, which sits above the overlay. There is no quick-add
 * button; sizing/colour selection happens on the product page.
 */
export default function ProductCard({ product, showHeart = true }: Props) {
  const { toggle, isWished } = useWishlist();
  const [animating, setAnimating] = useState(false);

  const wished = isWished(product._id);
  // Manual "NEW" flag only — the badge shows when the admin ticks "Show NEW
  // badge on storefront" (isNewArrival), not on any time heuristic. Legacy
  // isNew accepted as a fallback for products saved before the rename.
  const showNew = Boolean(product.isNewArrival ?? product.isNew);

  const validImages = product.images?.filter(i => isValidImageUrl(i.url)) ?? [];
  const primaryImg = validImages.find(i => i.isPrimary) ?? validImages[0] ?? null;
  const heroUrl = primaryImg?.url ?? (isValidImageUrl(product.image) ? product.image : null);
  const heroAlt = primaryImg?.alt ?? product.name;
  // Second-image hover swap (OvH-style). CSS handles the fade — see .hoverImg.
  const hoverImg = validImages.find(i => i !== primaryImg) ?? null;
  const hoverUrl = hoverImg?.url ?? null;

  function handleHeart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(product._id);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <div className={styles.card}>
      {showHeart && (
        <button
          className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
          onClick={handleHeart}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
        >
          <Heart
            size={18}
            strokeWidth={1.5}
            fill={wished ? 'currentColor' : 'none'}
            className={wished ? styles.heartFilled : ''}
          />
        </button>
      )}

      <div className={styles.cardImg}>
        <ProductImage src={heroUrl} alt={heroAlt} variant="card" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hoverUrl && (
          <img
            src={hoverUrl}
            alt=""
            aria-hidden="true"
            className={styles.hoverImg}
            loading="lazy"
          />
        )}
        {showNew && <span className={styles.newBadge}>new</span>}
      </div>

      <div className={styles.caption}>
        {/* Stretched link: this anchor's ::after covers the whole card, so a
            click anywhere opens the PDP while keeping a real, crawlable link
            whose accessible name is the product name. */}
        <Link href={`/product/${product._id}`} className={styles.nameLink}>
          <h3 className={styles.cardName} title={product.name}>{product.name}</h3>
        </Link>
        <div className={styles.priceRow}>
          <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
