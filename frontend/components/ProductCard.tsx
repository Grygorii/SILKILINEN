'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Star } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { isValidImageUrl, cloudinaryUrl, cloudinarySrcSet } from '@/lib/imageUtils';
import ProductImage from './products/ProductImage';
import Price from './Price';
import styles from './ProductCard.module.css';

type ProductImageData = { url: string; isPrimary?: boolean; alt?: string; order?: number };

export type ProductCardData = {
  _id: string;
  slug?: string;
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
  /** Storefront rating summary (approved reviews), supplied by the list API. */
  ratingAverage?: number;
  ratingCount?: number;
};

type Props = {
  product: ProductCardData;
  /** Show the wishlist heart top-right. Default true. */
  showHeart?: boolean;
  /** Eager-load + preload this card's image — set on the first row (LCP). */
  priority?: boolean;
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
export default function ProductCard({ product, showHeart = true, priority = false }: Props) {
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

  // Size-at-a-glance: a first-time visitor shouldn't have to click through to
  // learn whether a piece is sized or one-size. Multiple variants list as
  // "S · M · L"; a single (or no) variant reads as "One size".
  const sizeList = (product.sizes ?? []).map(s => String(s).trim()).filter(Boolean);
  const sizeHint = sizeList.length > 1 ? sizeList.join(' · ') : 'One size';

  function handleHeart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(product._id);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <div className={styles.card} data-track="card_click" data-track-product={product._id} data-track-name={product.name}>
      {showHeart && (
        <button
          className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
          onClick={handleHeart}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          data-track="wishlist_toggle"
          data-track-product={product._id}
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
        <ProductImage src={heroUrl} alt={heroAlt} variant="card" loading={priority ? 'eager' : 'lazy'} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hoverUrl && (
          <img
            src={cloudinaryUrl(hoverUrl, 400)}
            srcSet={cloudinarySrcSet(hoverUrl, [200, 300, 400, 600], 'fill')}
            sizes="(max-width: 600px) 50vw, (max-width: 1200px) 33vw, 25vw"
            alt=""
            aria-hidden="true"
            className={styles.hoverImg}
            loading="lazy"
          />
        )}
        {/* Silk sheen — a soft diagonal light ripple sweeps across the image on
            hover, evoking the way silk catches the light. pointer-events:none so
            the stretched card link still receives the click. */}
        <span className={styles.sheen} aria-hidden="true" />
        {showNew && <span className={styles.newBadge}>new</span>}
        {/* Size hint — a cream band that lifts up on hover, the lettering
            settling a beat after. Pointer-hover devices only (hidden on phones;
            sizes live on the product page). */}
        <span className={styles.sizeOverlay}><span className={styles.sizeInner}>{sizeHint}</span></span>
      </div>

      <div className={styles.caption}>
        {/* Stretched link: this anchor's ::after covers the whole card, so a
            click anywhere opens the PDP while keeping a real, crawlable link
            whose accessible name is the product name. */}
        <Link href={`/product/${product.slug || product._id}`} className={styles.nameLink}>
          <h3 className={styles.cardName} title={product.name}>{product.name}</h3>
        </Link>
        {product.ratingCount ? (
          <div className={styles.rating} aria-label={`Rated ${product.ratingAverage} out of 5 from ${product.ratingCount} reviews`}>
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                size={12}
                strokeWidth={1.5}
                fill={n <= Math.round(product.ratingAverage ?? 0) ? 'currentColor' : 'none'}
              />
            ))}
            <span className={styles.ratingCount}>({product.ratingCount})</span>
          </div>
        ) : null}
        <div className={styles.priceRow}>
          <Price eur={Number(product.price)} className={styles.price} />
        </div>
      </div>
    </div>
  );
}
