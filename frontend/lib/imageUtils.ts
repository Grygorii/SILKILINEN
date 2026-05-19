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
