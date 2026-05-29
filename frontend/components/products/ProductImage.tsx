'use client';

import { useState, useEffect, useRef } from 'react';
import { isValidImageUrl, cloudinaryUrl } from '@/lib/imageUtils';
import styles from './ProductImage.module.css';

type Variant = 'card' | 'thumbnail' | 'cart';

const WIDTHS: Record<Variant, number> = {
  card: 400,
  thumbnail: 160,
  cart: 200,
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
 * Renders a product image with three states:
 *   loading  → shimmer skeleton
 *   failed   → cream "Image coming soon" placeholder (text hidden at cart/thumbnail sizes)
 *   loaded   → the actual image, faded in
 *
 * The caller's wrapClassName div must provide width + height (or aspect-ratio).
 * ProductImage fills that space with position:absolute children.
 */
export default function ProductImage({ images, src, alt, variant, wrapClassName, loading = 'lazy' }: Props) {
  const url = images?.length ? resolveUrl(images) : (isValidImageUrl(src) ? src! : null);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed');
  const imgRef = useRef<HTMLImageElement>(null);

  // Hydration race fix: when the browser fetches the image BEFORE React
  // hydrates (cached images, fast networks, mobile Safari), the onLoad
  // event fires while React isn't listening yet — state stays "loading"
  // forever and opacity stays at 0, so the image is invisible until the
  // user interacts. On mount, check whether the underlying <img> is
  // already complete and skip the loading state if so.
  useEffect(() => {
    if (!url) return;
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) {
      // naturalHeight === 0 on a complete-but-broken image (failed fetch).
      if (img.naturalHeight > 0) setState('loaded');
      else setState('failed');
    }
  }, [url]);

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
      {url && (
        <img
          ref={imgRef}
          src={cloudinaryUrl(url, WIDTHS[variant])}
          alt={alt}
          className={styles.img}
          loading={loading}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          style={{ opacity: state === 'loaded' ? 1 : 0 }}
        />
      )}
    </div>
  );
}
