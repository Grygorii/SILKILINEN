'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
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

  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.category === filter);

  function handleAdd(product: Product) {
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
              <a href={`/product/${product._id}`} className={styles.cardImgLink}>
                <div className={styles.cardImg}>
                  <span className={styles.viewBtn}>View product</span>
                </div>
              </a>
              <div className={styles.cardInfo}>
                <a href={`/product/${product._id}`} className={styles.cardName}>
                  <h3>{product.name}</h3>
                </a>
                <div className={styles.colours}>
                  {product.colours?.map(colour => (
                    <span key={colour} className={styles.colourDot} title={colour} />
                  ))}
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
                  <button
                    className={`${styles.addBtn} ${isAdded ? styles.addedBtn : ''}`}
                    onClick={() => handleAdd(product)}
                  >
                    {isAdded ? '✓ Added' : hasSizes ? 'Select size' : 'Add to cart'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
