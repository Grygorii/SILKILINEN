'use client';

import { useState } from 'react';
import styles from './SilkImage.module.css';

interface Props {
  /** Primary image URL. */
  src: string;
  alt: string;
  /** Optional second image — fades in on hover (desktop only via CSS). */
  hoverSrc?: string;
  /** Optional fabric video. When set, renders as <video> with `src` as poster. */
  video?: string;
  /** Native <img loading> attribute. Defaults to 'lazy'. */
  loading?: 'lazy' | 'eager';
  /** Extra class on the outer wrapper. Caller controls dimensions. */
  className?: string;
  /** Forwarded to the underlying <img>. Lets callers track broken images. */
  onError?: () => void;
}

/**
 * Product imagery with an ambient sheen overlay (silk catching light)
 * and an optional hover swap. Video-ready: pass `video` and the wrapper
 * becomes a <video> element with the still image as its poster — sheen
 * still plays over it. Falls back to <img> when no video is provided.
 *
 * The sheen overlay is pointer-events:none and lives on a ::after
 * pseudo-element, so it never blocks clicks or hover targeting of
 * elements above the image (e.g. heart button, "new" badge).
 *
 * prefers-reduced-motion: reduce stops the sheen animation cleanly.
 */
export default function SilkImage({ src, alt, hoverSrc, video, loading = 'lazy', className, onError }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ''}`}>
      {video ? (
        <video
          className={styles.media}
          src={video}
          poster={src}
          muted
          playsInline
          loop
          autoPlay
          aria-label={alt}
        />
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            className={styles.media}
            loading={loading}
            onLoad={() => setLoaded(true)}
            onError={onError}
            style={{ opacity: loaded ? 1 : 0 }}
          />
          {hoverSrc && (
            <img
              src={hoverSrc}
              alt=""
              aria-hidden="true"
              className={`${styles.media} ${styles.mediaHover}`}
              loading="lazy"
            />
          )}
        </>
      )}
      <span className={styles.sheen} aria-hidden="true" />
    </div>
  );
}
