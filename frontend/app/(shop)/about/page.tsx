import styles from './page.module.css';

export const metadata = {
  title: 'About Us — SILKILINEN',
  description: 'The story behind SILKILINEN — pure silk and linen intimates made for everyday luxury, shipped worldwide from Dublin, Ireland.',
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1>Our story.</h1>
        <p>Born in Dublin, made for everywhere.</p>
      </div>
      <div className={styles.content}>
        <div className={styles.block}>
          <h2>Why silk?</h2>
          <p>Silk is one of nature's most remarkable fabrics. It's naturally temperature regulating, hypoallergenic, and incredibly gentle on skin. We believe every woman deserves to feel that luxury every single day.</p>
        </div>
        <div className={styles.block}>
          <h2>Our promise</h2>
          <p>Every piece in our collection is made from the highest quality silk available. No shortcuts, no compromises. Just pure, beautiful silk delivered to your door from Dublin, Ireland.</p>
        </div>
        <div className={styles.block}>
          <h2>Worldwide shipping</h2>
          <p>We ship to over 50 countries worldwide. Every order is carefully packaged and shipped with love. Because you deserve to receive something that feels as special as it looks.</p>
        </div>
      </div>
    </main>
  );
}