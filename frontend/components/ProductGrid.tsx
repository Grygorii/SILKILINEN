'use client';

import { useState } from 'react';
import styles from './ProductGrid.module.css';

type Product = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  description: string;
};

const categories = ['all', 'shorts', 'dresses', 'robes', 'shirts', 'scarves'];

export default function ProductGrid({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? products
    : products.filter(p => p.category === filter);

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
        {filtered.map(product => (
          <a key={product._id} href={`/product/${product._id}`} className={styles.card}>
            <div className={styles.cardImg}></div>
            <div className={styles.cardInfo}>
              <h3>{product.name}</h3>
              <div className={styles.colours}>
                {product.colours.map(colour => (
                  <span key={colour} className={styles.colourDot} title={colour}></span>
                ))}
              </div>
              <span>€{product.price}.00</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}