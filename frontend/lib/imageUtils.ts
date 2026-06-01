/** Returns true if the URL is safe to use as an image src. */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  if (/gemini\.google\.com/i.test(url)) return false;
  return true;
}

/** Apply a Cloudinary width transform. Falls back to the original URL for non-Cloudinary sources. */
export function cloudinaryUrl(url: string, width: number): string {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${width},c_fill,f_auto,q_auto/`);
  }
  return url;
}

/**
 * Cloudinary URL with WebP/AVIF auto, smart quality, capped width — without
 * the c_fill crop. Use for images where we don't want the source
 * cropped (collection tiles, lifestyle shots). The PageSpeed audit flagged
 * 13 MB of image savings; almost all of it came from raw <img src> tags
 * pulling original-resolution Cloudinary URLs.
 */
export function cloudinaryAuto(url: string, maxWidth: number): string {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${maxWidth},c_limit,f_auto,q_auto/`);
  }
  return url;
}
