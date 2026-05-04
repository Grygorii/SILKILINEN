'use client';

import { useState } from 'react';
import { Heart, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import styles from './ProductGallery.module.css';

type ProductImage = { url: string; alt?: string; isPrimary?: boolean };

type Props = {
  images: ProductImage[];
  name: string;
  productId: string;
};

export default function ProductGallery({ images, name, productId }: Props) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const { toggle, isWished } = useWishlist();

  const wished = isWished(productId);
  const img = images[current];
  const hasMultiple = images.length > 1;

  function prev() { setCurrent(i => (i - 1 + images.length) % images.length); }
  function next() { setCurrent(i => (i + 1) % images.length); }

  function handleHeart() {
    toggle(productId);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <div className={styles.gallery}>
      {/* Main image */}
      <div className={styles.imageWrap} onClick={() => img?.url && setLightboxOpen(true)}>
        {img?.url ? (
          <img src={img.url} alt={img.alt ?? name} className={styles.heroImg} />
        ) : (
          <div className={styles.placeholder} />
        )}
        {hasMultiple && (
          <>
            <button
              className={`${styles.arrow} ${styles.arrowLeft}`}
              onClick={e => { e.stopPropagation(); prev(); }}
              aria-label="Previous image"
            >
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button
              className={`${styles.arrow} ${styles.arrowRight}`}
              onClick={e => { e.stopPropagation(); next(); }}
              aria-label="Next image"
            >
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      {/* Heart — always top-right of image */}
      <button
        className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
        onClick={handleHeart}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={26} strokeWidth={1.5} fill={wished ? 'currentColor' : 'none'} />
      </button>

      {/* Dots */}
      {hasMultiple && (
        <div className={styles.dots}>
          {images.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => setCurrent(i)}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && img?.url && (
        <div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxOpen(false)} aria-label="Close">
            <X size={22} strokeWidth={1.5} />
          </button>
          <img
            src={img.url}
            alt={img.alt ?? name}
            className={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
