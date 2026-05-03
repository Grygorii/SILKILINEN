import { type Content } from '@/lib/content';
import styles from './InstagramGrid.module.css';

export default function InstagramGrid({ content = {} }: { content?: Content }) {
  const images = [1, 2, 3, 4, 5, 6].map(i => ({
    url: content[`instagram_image_${i}`]?.value || '',
    alt: content[`instagram_image_${i}`]?.altText || `Instagram photo ${i}`,
  }));

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>@silkilinen</h2>
        <p className={styles.sub}>Follow along for daily inspiration</p>
      </div>
      <div className={styles.grid}>
        {images.map((img, i) => (
          <div key={i} className={styles.cell}>
            {img.url && (
              <img src={img.url} alt={img.alt} className={styles.cellImg} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <a
          href="https://instagram.com/silkilinen"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.followBtn}
        >
          Follow on Instagram
        </a>
      </div>
    </section>
  );
}
