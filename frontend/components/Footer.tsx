import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      {/* Trust badges */}
      <div className={styles.trust}>
        <div className={styles.trustBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Secure checkout via Stripe</span>
        </div>
        <div className={styles.trustBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>14-day hassle-free returns</span>
        </div>
        <div className={styles.trustBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>OEKO-TEX certified silk</span>
        </div>
        <div className={styles.trustBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>Handmade in Dublin</span>
        </div>
      </div>

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
        <p>Registered in Dublin, Ireland · VAT not applicable — small business exemption (Ireland)</p>
      </div>
    </footer>
  );
}
