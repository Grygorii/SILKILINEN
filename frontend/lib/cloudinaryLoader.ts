/**
 * Custom next/image loader.
 *
 * Routes Cloudinary images through Cloudinary's own transforms (width +
 * f_auto/q_auto) rather than the default Next.js optimizer — which would
 * re-optimize already-optimized assets and lose the format/quality-auto.
 * Non-Cloudinary URLs pass through unchanged (a custom loader bypasses the
 * remotePatterns domain check, so this is safe for any host).
 *
 * Using this as a per-`<Image loader>` prop keeps the blast radius to the
 * components that opt in, leaving any remaining raw <img> tags untouched.
 */
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;
  const q = quality ? `q_${quality}` : 'q_auto';
  return src.replace('/upload/', `/upload/w_${width},c_limit,f_auto,${q}/`);
}
