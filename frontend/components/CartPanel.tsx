'use client';

import { useCart } from '@/context/CartContext';
import styles from './CartPanel.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartPanel({ isOpen, onClose }: Props) {
  const { cart, removeFromCart } = useCart();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <h3>Your cart</h3>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.items}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <p>Your cart is empty.</p>
              <p>Discover our collection and find something you love.</p>
              <button className={styles.shopBtn} onClick={onClose}>Shop now</button>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className={styles.item}>
                <div className={styles.itemImg}></div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemDetails}>{item.colour} / {item.size}</p>
                  <p className={styles.itemPrice}>€{item.price * item.quantity}.00 × {item.quantity}</p>
                </div>
                <button className={styles.remove} onClick={() => removeFromCart(index)}>✕</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.total}>
              <span>Total</span>
              <span>€{total}.00</span>
            </div>
            <button className={styles.checkout}>Checkout</button>
          </div>
        )}
      </div>
    </>
  );
}