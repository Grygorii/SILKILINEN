import styles from './StyleFinderBand.module.css';

/**
 * Homepage Style Finder entry band. The CTA's gradient drifts copper→blush and
 * lifts with a shine sweep on hover, evoking the way silk catches the light.
 * Click tracking is handled globally via the data-track attribute.
 */
export default function StyleFinderBand() {
  return (
    <a href="/style-finder" className={styles.finderBand} data-track="quiz_cta">
      <span className={styles.finderEyebrow}>The 60-second quiz</span>
      <span className={styles.finderTitle}>Which silk are you?</span>
      <span className={styles.finderCue}>
        Answer four quiet questions and we&rsquo;ll gather the pieces made for you.
      </span>
      <span className={styles.finderBtn}>Take the Style Finder &rarr;</span>
    </a>
  );
}
