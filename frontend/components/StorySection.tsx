import Link from 'next/link';
import Image from 'next/image';
import { type Content, val } from '@/lib/content';
import { EditableText, EditableImage } from '@/components/inline/InlineEdit';
import styles from './StorySection.module.css';

const DEFAULT_TEXT = 'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres. We source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nWe\'re an Irish brand based in Donegal, and we share a commitment to slow, considered work.';

export default function StorySection({ content = {} }: { content?: Content }) {
  const image = val(content, 'homepage_story_image');
  const title = val(content, 'homepage_story_title', 'Born in Donegal,\nworn across the world');
  const rawText = val(content, 'homepage_story_text', DEFAULT_TEXT);

  return (
    <section className={styles.section}>
      <div className={styles.imageCol}>
        <EditableImage contentKey="homepage_story_image" section="homepage">
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
            {/* HUMAN: replace placeholder pull quote — see UX-PUBLIC.md M6 */}
            <p className={styles.pullQuote}>&ldquo;Made with love,<br />worn with intention.&rdquo;</p>
          </div>
        )}
        </EditableImage>
      </div>
      <div className={styles.textCol}>
        <p className={styles.eyebrow}>Our story</p>
        <EditableText as="h2" className={styles.heading} contentKey="homepage_story_title" value={title} />
        {/* Story copy lives under one content key, so it edits as a single block.
            `pre-line` keeps the blank-line paragraph breaks when not editing. */}
        <EditableText as="div" className={styles.body} contentKey="homepage_story_text" value={rawText} multiline style={{ whiteSpace: 'pre-line' }} />
        <Link href="/about" className={styles.link}>Read our story →</Link>
      </div>
    </section>
  );
}
