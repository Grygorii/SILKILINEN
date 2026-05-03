import { getContent, val } from '@/lib/content';
import styles from './page.module.css';

export const metadata = {
  title: 'About Us — SILKILINEN',
  description: 'The story behind SILKILINEN — pure silk and linen intimates made for everyday luxury, shipped worldwide from Dublin, Ireland.',
};

export default async function AboutPage() {
  const content = await getContent('about');

  const heroImage = val(content, 'about_hero_image');
  const image1 = val(content, 'about_story_image_1');
  const image2 = val(content, 'about_story_image_2');
  const rawText = val(content, 'about_story_text',
    'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres.\n\nWe source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nEvery piece is designed in Dublin and crafted by skilled artisans who share our commitment to slow, considered making. We produce in small batches, never rushing the process, so that what reaches you is exactly what we intended — something you\'ll reach for again and again.'
  );
  const paragraphs = rawText.split('\n\n').filter(Boolean);

  return (
    <main className={styles.page}>
      <div
        className={`${styles.hero} ${heroImage ? styles.heroWithImage : ''}`}
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <p className={styles.heroEyebrow}>Our story</p>
        <h1>Born in Dublin,<br />made for everywhere.</h1>
      </div>

      <div className={styles.content}>
        {image1 && (
          <div className={styles.storyImageWrap}>
            <img src={image1} alt={content.about_story_image_1?.altText || 'Our story'} className={styles.storyImg} />
          </div>
        )}

        <div className={styles.textBlock}>
          {paragraphs.map((p, i) => (
            <p key={i} className={styles.body}>{p}</p>
          ))}
        </div>

        {image2 && (
          <div className={styles.storyImageWrap}>
            <img src={image2} alt={content.about_story_image_2?.altText || 'Our craft'} className={styles.storyImg} />
          </div>
        )}

        <div className={styles.valuesGrid}>
          {[
            { title: 'Natural fibres only', body: 'Every piece is made from Mulberry silk or European linen — nothing synthetic, nothing treated with harsh chemicals.' },
            { title: 'Small batch', body: 'We produce in small runs so nothing is wasted and every piece gets the attention it deserves.' },
            { title: 'OEKO-TEX certified', body: 'Our silks are certified safe for skin contact, free from harmful substances.' },
            { title: 'Made with care', body: 'Designed in Dublin, crafted by skilled artisans who share our values.' },
          ].map(v => (
            <div key={v.title} className={styles.valueCard}>
              <h3 className={styles.valueTitle}>{v.title}</h3>
              <p className={styles.valueBody}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
