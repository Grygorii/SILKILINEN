import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h3>SILKILINEN</h3>
          <p>Pure silk & linen intimates,<br />shipped worldwide from Dublin.</p>
        </div>
        <div className={styles.col}>
          <h4>Shop</h4>
          <a href="/shop">New arrivals</a>
          <a href="/shop">All products</a>
          <a href="/shop?category=robes">Robes</a>
          <a href="/shop?category=dresses">Dresses</a>
        </div>
        <div className={styles.col}>
          <h4>Info</h4>
          <a href="/about">About us</a>
          <a href="/reviews">Reviews</a>
          <a href="/shipping">Shipping &amp; Returns</a>
          <a href="/contact">Contact</a>
        </div>
        <div className={styles.col}>
          <h4>Follow us</h4>
          <a href="#">Instagram</a>
          <a href="#">Pinterest</a>
          <a href="#">TikTok</a>
        </div>
      </div>
      <div className={styles.bottom}>
        <p>© 2025 Silkilinen. All rights reserved.</p>
        <p>Dublin, Ireland · Worldwide shipping</p>
      </div>
    </footer>
  );
}