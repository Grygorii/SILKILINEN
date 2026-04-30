import styles from './Navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.hamburger}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className={styles.logo}>
        <h1>SILKILINEN</h1>
        <p>Silk & Linen</p>
      </div>
      <div className={styles.cart}>
        <p>Cart (0)</p>
      </div>
    </nav>
  );
}