'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { colourToHex } from '@/lib/colours';
import styles from './ProductGrid.module.css';

type Product = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  sizes: string[];
  description: string;
};

const categories = ['all', 'shorts', 'dresses', 'robes', 'shirts', 'scarves'];

export default function ProductGrid({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('all');
  const [addedId, setAddedId] = useState<string | null>(null);
  const { addToCart } = useCart();
  const { toggle, isWished } = useWishlist();

  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.category === filter);

  function handleAdd(e: React.MouseEvent, product: Product) {
    e.preventDefault();
    e.stopPropagation();
    const hasSizes = product.sizes?.length > 0;
    if (hasSizes) {
      window.location.href = `/product/${product._id}`;
      return;
    }
    addToCart({
      name: product.name,
      price: product.price,
      colour: product.colours?.[0] ?? '',
      size: '',
      quantity: 1,
    });
    setAddedId(product._id);
    setTimeout(() => setAddedId(null), 1500);
  }

  return (
    <div>
      <div className={styles.filters}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${filter === cat ? styles.active : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {filtered.map(product => {
          const hasSizes = product.sizes?.length > 0;
          const isAdded = addedId === product._id;

          return (
            <div key={product._id} className={styles.card}>
              {/* Image area */}
              <div className={styles.cardImg}>
                <button
                  className={`${styles.heartBtn} ${isWished(product._id) ? styles.heartActive : ''}`}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(product._id); }}
                  aria-label={isWished(product._id) ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  {isWished(product._id) ? '♥' : '♡'}
                </button>
                <span className={styles.viewBtn}>View product</span>
              </div>

              {/* Info area */}
              <div className={styles.cardInfo}>
                <h3 className={styles.cardName}>{product.name}</h3>
                <div className={styles.colours}>
                  {product.colours?.map(colour => {
                    const hex = colourToHex(colour);
                    return (
                      <span
                        key={colour}
                        className={styles.colourDot}
                        title={colour}
                        style={hex ? { background: hex, borderColor: hex === '#ffffff' ? '#e0ddd7' : 'transparent' } : undefined}
                      />
                    );
                  })}
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
                  <button
                    className={`${styles.addBtn} ${isAdded ? styles.addedBtn : ''}`}
                    onClick={e => handleAdd(e, product)}
                  >
                    {isAdded ? '✓ Added' : hasSizes ? 'Select size' : 'Add to cart'}
                  </button>
                </div>
              </div>

              {/*
                Overlay placed LAST in DOM so it stacks above image + info.
                z-index: 1 sits above both. heartBtn and cardBottom use z-index: 2
                via pointer-events: auto + position: relative.
              */}
              <Link
                href={`/product/${product._id}`}
                className={styles.cardOverlay}
                aria-label={`View ${product.name}`}
                tabIndex={-1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
