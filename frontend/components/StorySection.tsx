import Link from 'next/link';
import Image from 'next/image';
import { type Content, val } from '@/lib/content';
import styles from './StorySection.module.css';

const DEFAULT_TEXT = 'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres. We source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nEvery piece is designed in Dublin and crafted by skilled artisans who share our commitment to slow, considered making.';

export default function StorySection({ content = {} }: { content?: Content }) {
  const image = val(content, 'homepage_story_image');
  const title = val(content, 'homepage_story_title', 'Crafted in Dublin,\nworn across the world');
  const rawText = val(content, 'homepage_story_text', DEFAULT_TEXT);
  const paragraphs = rawText.split('\n\n').filter(Boolean);

  return (
    <section className={styles.section}>
      <div className={styles.imageCol}>
        {image ? (
          <Image
            src={image}
            alt={content.homepage_story_image?.altText || 'Our story'}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={styles.storyImg}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <p className={styles.pullQuote}>&ldquo;Made with love,<br />worn with intention.&rdquo;</p>
          </div>
        )}
      </div>
      <div className={styles.textCol}>
        <p className={styles.eyebrow}>Our story</p>
        <h2 className={styles.heading}>{title}</h2>
        {paragraphs.map((p, i) => (
          <p key={i} className={styles.body}>{p}</p>
        ))}
        <Link href="/about" className={styles.link}>Read our story →</Link>
      </div>
    </section>
  );
}
