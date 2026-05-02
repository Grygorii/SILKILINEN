import Link from 'next/link';
import styles from './StorySection.module.css';

export default function StorySection() {
  return (
    <section className={styles.section}>
      <div className={styles.imageCol}>
        <div className={styles.imagePlaceholder}>
          <p className={styles.pullQuote}>&ldquo;Made with love,<br />worn with intention.&rdquo;</p>
        </div>
      </div>
      <div className={styles.textCol}>
        <p className={styles.eyebrow}>Our story</p>
        <h2 className={styles.heading}>Crafted in Dublin,<br />worn across the world</h2>
        <p className={styles.body}>
          SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres. We source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.
        </p>
        <p className={styles.body}>
          Every piece is designed in Dublin and crafted by skilled artisans who share our commitment to slow, considered making. We produce in small batches, never rushing the process, so that what reaches you is exactly what we intended — something you&rsquo;ll reach for again and again.
        </p>
        <Link href="/about" className={styles.link}>Read our story →</Link>
      </div>
    </section>
  );
}
