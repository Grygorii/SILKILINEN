'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Plus, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
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
  sizes?: string[];
  colours?: string[];
  images?: ProductImageData[];
  image?: string;
};

type Props = {
  product: ProductCardData;
  /** Show the wishlist heart top-right. Default true. */
  showHeart?: boolean;
  /** Show the "+" / Check add-to-bag button in the price row. Default true. */
  showAddButton?: boolean;
};

const NEW_DAYS = 30;

function getMaterialSub(mat?: string): string {
  if (!mat) return '';
  const m = mat.toLowerCase();
  if (m.includes('mulberry silk')) return 'in mulberry silk';
  if (m.includes('silk satin')) return 'in silk satin';
  if (m.includes('silk') && m.includes('linen')) return 'in silk & linen';
  if (m.includes('silk')) return 'in pure silk';
  if (m.includes('linen')) return 'in pure linen';
  return '';
}

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 86_400_000;
}

/**
 * Canonical product card used everywhere products are shown on the
 * storefront — shop grid, new arrivals, recently viewed, cross-sell,
 * wishlist, and bundle children. Each card is self-contained: it reads
 * from CartContext / WishlistContext directly and owns its own
 * ephemeral add/heart animation state.
 *
 * Surfaces that want to suppress the heart or add button (e.g. for
 * read-only product references) pass `showHeart={false}` or
 * `showAddButton={false}`.
 */
export default function ProductCard({
  product,
  showHeart = true,
  showAddButton = true,
}: Props) {
  const { addToCart } = useCart();
  const { toggle, isWished } = useWishlist();
  const [added, setAdded] = useState(false);
  const [animating, setAnimating] = useState(false);

  // `sizes` is the source of truth for "needs PDP variant selection". When
  // the surface passed an explicit array we trust it (length 0 = one-size,
  // direct add). When it's undefined (e.g. minimal wishlist payload), we
  // can't be sure — redirect to PDP to avoid adding a size-less line for a
  // product that actually has variants.
  const sizesKnown = Array.isArray(product.sizes);
  const hasSizes = sizesKnown && (product.sizes?.length ?? 0) > 0;
  const wished = isWished(product._id);
  const materialSub = getMaterialSub(product.materialComposition);
  const showNew = isNew(product.createdAt);

  const validImages = product.images?.filter(i => isValidImageUrl(i.url)) ?? [];
  const primaryImg = validImages.find(i => i.isPrimary) ?? validImages[0] ?? null;
  const heroUrl = primaryImg?.url ?? (isValidImageUrl(product.image) ? product.image : null);
  const heroAlt = primaryImg?.alt ?? product.name;
  // Second-image hover swap (OvH-style). Use the first non-primary valid
  // image, falling back to validImages[1] if no isPrimary flag is set.
  // CSS handles the actual fade — see .hoverImg in ProductCard.module.css.
  const hoverImg = validImages.find(i => i !== primaryImg) ?? null;
  const hoverUrl = hoverImg?.url ?? null;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!sizesKnown || hasSizes) {
      // Either has variants OR we don't have variant data — PDP for selection.
      window.location.href = `/product/${product._id}`;
      return;
    }
    addToCart({
      productId: product._id,
      name: product.name,
      price: product.price,
      colour: product.colours?.[0] ?? '',
      size: '',
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

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

      <Link href={`/product/${product._id}`} className={styles.cardLink}>
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
      </Link>

      <div className={styles.caption}>
        <h3 className={styles.cardName} title={product.name}>{product.name}</h3>
        {/* Always-render so the reserved 1-line height keeps every
            caption the same total height — rows can't drift out of
            alignment when some products lack materialComposition. */}
        <p className={styles.materialSub}>{materialSub}</p>
        <div className={styles.priceRow}>
          <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
          {showAddButton && (
            <button
              className={styles.plusIconBtn}
              onClick={handleAdd}
              aria-label={added ? 'Added to bag' : hasSizes ? 'Select size' : 'Add to bag'}
            >
              {added
                ? <Check size={18} strokeWidth={1.5} />
                : <Plus size={18} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
