import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h3>SILKILINEN</h3>
          <p>Pure silk &amp; linen intimates,<br />shipped worldwide from Dublin.</p>
          <p className={styles.address}>
            Dublin, Ireland<br />
            <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a>
          </p>
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
          <a href="/shipping">Shipping</a>
          <a href="/size-guide">Size guide</a>
          <a href="/contact">Contact</a>
        </div>
        <div className={styles.col}>
          <h4>Legal</h4>
          <a href="/privacy-policy">Privacy policy</a>
          <a href="/terms">Terms &amp; conditions</a>
          <a href="/returns">Returns &amp; refunds</a>
        </div>
      </div>
      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} SILKILINEN. All rights reserved.</p>
        <p>Registered in Dublin, Ireland · VAT included in all prices</p>
      </div>
    </footer>
  );
}
