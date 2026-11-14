import { QUESTION_COUNT_WORD } from '@/lib/styleFinder';
import styles from './StyleFinderBand.module.css';

/**
 * Homepage Style Finder entry band. The whole band is the invitation; its
 * visible cue stays a quiet editorial action rather than a second, competing
 * button inside the link.
 * Click tracking is handled globally via the data-track attribute.
 */
export default function StyleFinderBand() {
  return (
    <a href="/style-finder" className={styles.finderBand} data-track="quiz_cta">
      <span className={styles.finderEyebrow}>The 60-second quiz</span>
      <span className={styles.finderTitle}>Which silk are you?</span>
      {/* Count comes from lib/styleFinder, which StyleFinder.tsx asserts its
          QUESTIONS array against — so this line can't drift from the quiz. */}
      <span className={styles.finderCue}>
        Answer {QUESTION_COUNT_WORD} quiet questions and we&rsquo;ll gather the pieces made for you.
      </span>
      <span className={styles.finderBtn}>Take the Style Finder</span>
    </a>
  );
}
