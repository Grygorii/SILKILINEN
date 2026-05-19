'use client';

import { isValidImageUrl, cloudinaryUrl } from '@/lib/imageUtils';

type ProductImageData = { url: string; alt?: string; isPrimary?: boolean; order?: number };

const WIDTHS: Record<string, number> = {
  card: 400,
  thumbnail: 160,
  cart: 200,
};

interface Props {
  /** Pass the full images array to resolve primary/order automatically. */
  images?: ProductImageData[];
  /** Or pass a single URL directly. */
  src?: string | null;
  alt: string;
  variant: keyof typeof WIDTHS;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/** Resolves the best valid URL from an images array (primary first, then by order). */
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
 * Renders a single product image with:
 * - Pre-validation (Gemini URLs and non-HTTP strings are rejected before load)
 * - Cloudinary width transform for the requested variant
 * - onError hiding when the image actually fails to load
 * Returns null when no valid URL is available.
 */
export default function ProductImage({ images, src, alt, variant, className, loading = 'lazy' }: Props) {
  const url = images?.length ? resolveUrl(images) : (isValidImageUrl(src) ? src! : null);
  if (!url) return null;

  const width = WIDTHS[variant] ?? 400;

  return (
    <img
      src={cloudinaryUrl(url, width)}
      alt={alt}
      className={className}
      loading={loading}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
