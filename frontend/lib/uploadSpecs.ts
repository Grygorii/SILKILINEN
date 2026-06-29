// Single source of truth for "what to upload" guidance across the admin editors
// that don't already show it (the Site Content editor has its own richer panel).
// Dimensions/ratios mirror how each asset is actually displayed on the
// storefront; max sizes mirror the backend upload limits.

export type UploadSpec = {
  dimensions?: string;
  aspect?: string;
  formats?: string;
  maxSize?: string;
  note?: string;
};

export const UPLOAD_SPECS: Record<string, UploadSpec> = {
  // Product gallery renders a 4:5 portrait (see ProductGallery.module.css).
  productImage: {
    dimensions: '1200 × 1500 px',
    aspect: '4:5 portrait',
    formats: 'JPG, PNG or WebP',
    maxSize: 'Under 25 MB',
    note: 'Shoot vertical with the piece centred — the storefront crops to a 4:5 portrait. Clean, evenly-lit neutral background. The first image is the one shown on the shop grid.',
  },
  productVideo: {
    dimensions: '1080 × 1350 px',
    aspect: '4:5 portrait',
    formats: 'MP4 or WebM',
    maxSize: 'Under 30 MB',
    note: 'Short (5–15s), muted loop. Plays in the gallery in place of the first photo.',
  },
  // Journal hero — full-width band at the top of the article (object-fit cover).
  journalHero: {
    dimensions: '1600 × 900 px',
    aspect: '16:9 landscape',
    formats: 'JPG, PNG or WebP',
    maxSize: 'Under 10 MB',
    note: 'Wide editorial image, full-width above the title. Keep the focal point centred — the edges crop on narrow screens.',
  },
  // Collection hero — full-width banner with the title overlaid in the centre.
  collectionHero: {
    dimensions: '2000 × 800 px',
    aspect: 'wide landscape (≈5:2)',
    formats: 'JPG, PNG or WebP',
    maxSize: 'Under 25 MB',
    note: 'Full-width banner behind the collection name. Centre the subject; the title sits over the middle, so leave that area uncluttered.',
  },
  // Homepage hero video.
  heroVideo: {
    dimensions: '1920 × 1080 px',
    aspect: '16:9 landscape',
    formats: 'MP4 or WebM',
    maxSize: 'Under 30 MB',
    note: 'Short (5–15s), muted, seamless loop. A frame of it is used as the poster image on slow connections.',
  },
};
