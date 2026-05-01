'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { colourToHex } from '@/lib/colours';
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
  const [error, setError] = useState('');
  const { addToCart } = useCart();

  function handleAddToCart() {
    if (!selectedColour) { setError('Please select a colour'); return; }
    if (sizes.length > 0 && !selectedSize) { setError('Please select a size'); return; }
    setError('');
    addToCart({
      name: productName,
      price,
      colour: selectedColour,
      size: selectedSize,
      quantity: 1,
    });
  }

  return (
    <div>
      <div className={styles.picker}>
        <p>Colour{selectedColour ? <span className={styles.selectedLabel}> — {selectedColour}</span> : ''}</p>
        <div className={styles.options}>
          {colours.map(colour => {
            const hex = colourToHex(colour);
            return (
              <button
                key={colour}
                title={colour}
                aria-label={colour}
                className={`${styles.btn} ${hex ? styles.swatchBtn : ''} ${selectedColour === colour ? styles.active : ''}`}
                onClick={() => { setSelectedColour(colour); setError(''); }}
              >
                {hex ? (
                  <span
                    className={styles.swatch}
                    style={{ background: hex }}
                  />
                ) : (
                  colour
                )}
              </button>
            );
          })}
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
                onClick={() => { setSelectedSize(size); setError(''); }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.addToCart} onClick={handleAddToCart}>
        Add to cart
      </button>
    </div>
  );
}
