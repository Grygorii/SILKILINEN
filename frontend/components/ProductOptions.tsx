'use client';

import { useState } from 'react';
import styles from './ProductOptions.module.css';

type Props = {
  colours: string[];
  sizes: string[];
  productName: string;
  price: number;
};

export default function ProductOptions({ colours, sizes, productName, price }: Props) {
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  return (
    <div>
      <div className={styles.picker}>
        <p>Colour</p>
        <div className={styles.options}>
          {colours.map(colour => (
            <button
              key={colour}
              className={`${styles.btn} ${selectedColour === colour ? styles.active : ''}`}
              onClick={() => setSelectedColour(colour)}
            >
              {colour}
            </button>
          ))}
        </div>
      </div>

      {sizes.length > 0 && (
        <div className={styles.picker}>
          <p>Size</p>
          <div className={styles.options}>
            {sizes.map(size => (
              <button
                key={size}
                className={`${styles.btn} ${selectedSize === size ? styles.active : ''}`}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className={styles.addToCart}>
        Add to cart
      </button>
    </div>
  );
}