'use client';

import { useState } from 'react';
import Image from 'next/image';

// Journal card image with a graceful fallback. `isValidImageUrl` already filters
// malformed URLs upstream; this additionally catches a valid-looking URL that
// fails to LOAD (e.g. a dead Cloudinary link) via onError — so a broken hero
// never shows the browser's broken-image icon + raw alt text, only a calm cream
// panel. Client component so it can catch onError; the teaser stays a server one.
export default function ArticleImage({ src, alt, sizes }: { src?: string | null; alt: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--color-surface)' }} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      style={{ objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  );
}
