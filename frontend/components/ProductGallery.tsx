'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, Play, X } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { isValidImageUrl } from '@/lib/imageUtils';
import styles from './ProductGallery.module.css';

type ProductImage = {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  order?: number;
};

type ProductVideo = {
  url: string;
  thumbnailUrl?: string;
  cloudinaryPublicId?: string;
};

type MediaItem =
  | { kind: 'image'; url: string; alt: string }
  | { kind: 'video'; url: string; poster: string };

type Props = {
  images: ProductImage[];
  name: string;
  productId: string;
  video?: ProductVideo | null;
};

function cloudinaryThumb(url: string, width: number): string {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${width},c_fill,f_auto,q_auto/`);
  }
  return url;
}

function videoPoster(video: ProductVideo): string {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  return video.url
    .replace('/video/upload/', '/video/upload/so_0,f_jpg/')
    .replace(/\.(mp4|mov|webm)(\?.*)?$/, '.jpg');
}

function videoOptimized(video: ProductVideo): string {
  if (video.url.includes('res.cloudinary.com') && video.url.includes('/video/upload/')) {
    return video.url.replace('/video/upload/', '/video/upload/q_auto,f_auto/');
  }
  return video.url;
}

export default function ProductGallery({ images, name, productId, video }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toggle, isWished } = useWishlist();
  const wished = isWished(productId);

  // Sort: primary first, then by order field; skip entries with missing or broken URLs
  const sorted = [...images]
    .filter(img => isValidImageUrl(img.url) && !failedUrls.has(img.url))
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });

  const items: MediaItem[] = [
    ...sorted.map(img => ({ kind: 'image' as const, url: img.url, alt: img.alt || name })),
    ...(video?.url
      ? [{ kind: 'video' as const, url: videoOptimized(video), poster: videoPoster(video) }]
      : []),
  ];

  // Clamp current index when items shrink due to broken images being removed
  useEffect(() => {
    if (current >= items.length && items.length > 0) setCurrent(0);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMultiple = items.length > 1;
  const item = items[current];

  function goTo(index: number) {
    if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
    setCurrent(index);
  }

  function handleHeart() {
    toggle(productId);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(delta < 0 ? (current + 1) % items.length : (current - 1 + items.length) % items.length);
  }

  return (
    <div className={styles.gallery}>
      {/* Desktop: vertical thumbnail strip */}
      {hasMultiple && (
        <div className={styles.thumbStrip}>
          {items.map((it, i) => (
            <button
              key={i}
              className={`${styles.thumb} ${i === current ? styles.thumbActive : ''}`}
              onClick={() => goTo(i)}
              aria-label={it.kind === 'video' ? 'Show video' : `Photo ${i + 1}`}
            >
              {it.kind === 'image' ? (
                <img
                  src={cloudinaryThumb(it.url, 160)}
                  alt=""
                  className={styles.thumbImg}
                  loading="lazy"
                  onError={() => setFailedUrls(prev => new Set([...prev, it.url]))}
                />
              ) : (
                <div className={styles.thumbVideo}>
                  <img src={it.poster} alt="" className={styles.thumbImg} loading="lazy" />
                  <span className={styles.thumbPlay}>
                    <Play size={14} fill="white" strokeWidth={0} />
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main media area */}
      <div
        className={styles.mainArea}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {item?.kind === 'image' && (
          <div className={styles.imageWrap} onClick={() => setLightboxOpen(true)}>
            <img
              src={cloudinaryThumb(item.url, 1200)}
              alt={item.alt}
              className={styles.heroImg}
              onError={() => setFailedUrls(prev => new Set([...prev, item.url]))}
            />
          </div>
        )}

        {item?.kind === 'video' && (
          <div className={styles.videoWrap}>
            <video
              ref={videoRef}
              src={item.url}
              poster={item.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className={styles.heroVideo}
            />
          </div>
        )}

        {!item && <div className={styles.placeholder} />}

        {/* Heart — floats on image, no circle background */}
        <button
          className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
          onClick={handleHeart}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={18} strokeWidth={1.5} fill={wished ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Mobile: page dots */}
      {hasMultiple && (
        <div className={styles.dots}>
          {items.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Lightbox — desktop, images only */}
      {lightboxOpen && item?.kind === 'image' && (
        <div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
          <img
            src={cloudinaryThumb(item.url, 1600)}
            alt={item.alt}
            className={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
            onError={() => setFailedUrls(prev => new Set([...prev, item.url]))}
          />
        </div>
      )}
    </div>
  );
}
