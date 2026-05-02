'use client';

import styles from './SideMenu.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SideMenu({ isOpen, onClose }: Props) {
  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}>
        <button className={styles.close} onClick={onClose}>✕</button>
        <nav className={styles.links}>
          <a href="/" onClick={onClose}>Home</a>
          <a href="/shop" onClick={onClose}>Shop</a>
          <a href="/blog" onClick={onClose}>Journal</a>
          <a href="/reviews" onClick={onClose}>Reviews</a>
          <a href="/about" onClick={onClose}>About</a>
          <a href="/contact" onClick={onClose}>Contact</a>
        </nav>
      </div>
    </>
  );
}