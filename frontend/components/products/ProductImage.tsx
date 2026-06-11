'use client';

import { useState } from 'react';
import Image from 'next/image';
import { isValidImageUrl } from '@/lib/imageUtils';
import styles from './ProductImage.module.css';

type Variant = 'card' | 'thumbnail' | 'cart';

// `sizes` tells next/image which width to request from the Cloudinary loader.
const SIZES: Record<Variant, string> = {
  card: '(max-width: 600px) 50vw, (max-width: 1200px) 33vw, 25vw',
  thumbnail: '80px',
  cart: '96px',
};

type ProductImageData = { url: string; alt?: string; isPrimary?: boolean; order?: number };

interface Props {
  /** Full images array — resolves primary/order automatically. */
  images?: ProductImageData[];
  /** Single URL fallback when no images array is available. */
  src?: string | null;
  alt: string;
  variant: Variant;
  /** Extra class applied to the outer wrapper (caller sets dimensions). */
  wrapClassName?: string;
  loading?: 'lazy' | 'eager';
}

function resolveUrl(images: ProductImageData[]): string | null {
  const valid = images
    .filter(img => isValidImageUrl(img.url))
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  return valid[0]?.url ?? null;
}

/**
 * Product image via next/image (Cloudinary loader, `fill`):
 *   loading → shimmer skeleton
 *   failed  → cream "Image coming soon" placeholder (text hidden at small sizes)
 *   loaded  → the actual image, faded in
 *
 * next/image handles responsive srcset, lazy-loading, and the cached-image
 * hydration race that the previous hand-rolled version had to work around.
 * The wrapClassName div provides the positioned, sized box that `fill` needs.
 */
export default function ProductImage({ images, src, alt, variant, wrapClassName, loading = 'lazy' }: Props) {
  const url = images?.length ? resolveUrl(images) : (isValidImageUrl(src) ? src! : null);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed');

  const showText = variant === 'card';
  const variantClass = variant === 'card' ? styles.wrapCard : '';

  return (
    <div className={`${styles.wrap}${variantClass ? ` ${variantClass}` : ''}${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      {state === 'loading' && <div className={styles.skeleton} aria-hidden="true" />}
      {state === 'failed' && (
        <div className={styles.missing} aria-hidden="true">
          {showText && <span className={styles.missingText}>Image coming soon</span>}
        </div>
      )}
      {url && state !== 'failed' && (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={SIZES[variant]}
          className={styles.img}
          priority={loading === 'eager'}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          style={{ opacity: state === 'loaded' ? 1 : 0 }}
        />
      )}
    </div>
  );
}
