import styles from './page.module.css';

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h2>Pure silk,</h2>
          <h2>pure comfort.</h2>
          <p>Handcrafted silk & linen intimates</p>
          <a href="/shop" className={styles.heroBtn}>Shop the collection</a>
        </div>
      </section>
    </main>
  );
}