import styles from './page.module.css';
import PrintButton from './PrintButton';

export const metadata = {
  alternates: { canonical: 'https://www.silkilinen.com/care-guide' },
  title: 'Silk & Linen Care Guide',
  description: 'How to wash, dry, press and store mulberry silk and European linen so it lasts for years — SILKILINEN’s downloadable care guide.',
};

export default function CareGuidePage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.inner} ${styles.printable}`}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>The Care Guide</p>
          <h1>Silk &amp; Linen Care</h1>
          <p className={styles.intro}>
            Fine fabric asks for a little tenderness — and rewards it. Treat your pieces gently
            and they soften, settle and grow more beautiful with every wear. Here is everything
            you need to keep mulberry silk and European linen at their best.
          </p>
        </header>

        <div className={styles.actions}>
          <PrintButton />
        </div>

        {/* SILK */}
        <section className={styles.section}>
          <h2>Caring for silk</h2>
          <p className={styles.lede}>Mulberry silk is strong but delicate — cool water and a soft touch keep its lustre.</p>
          <ul className={styles.steps}>
            <li>
              <span className={styles.stepLabel}>Wash</span>
              <span><strong>Hand wash in cool water.</strong> Use a little pH-neutral or silk-specific detergent. Swirl gently for a minute or two — never rub, twist or wring. Machine washing is best avoided; if you must, use a mesh bag on a cold delicate cycle.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Rinse</span>
              <span><strong>Rinse in cool, clean water.</strong> A capful of white vinegar in the final rinse lifts any residue and restores shine. Press the water out between your palms — don’t wring.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Dry</span>
              <span><strong>Lay flat or hang in the shade.</strong> Roll in a clean towel to absorb excess water first. Keep silk out of direct sunlight, which fades colour over time.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Press</span>
              <span><strong>Iron on low, inside-out, while slightly damp.</strong> Use the silk setting with no steam, or place a thin cotton cloth between the iron and the fabric.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Store</span>
              <span><strong>Fold and keep somewhere cool and dark.</strong> Let pieces breathe — a cotton bag rather than plastic. Hang heavier silk pieces on padded hangers.</span>
            </li>
          </ul>
          <p className={styles.avoid}>
            <strong>Best avoided:</strong> bleach and harsh detergents, the tumble dryer,
            direct sun for long periods, and spritzing perfume or hairspray directly onto the
            fabric. Treat any mark promptly with cool water and a gentle hand.
          </p>
        </section>

        {/* LINEN */}
        <section className={styles.section}>
          <h2>Caring for linen</h2>
          <p className={styles.lede}>European linen only gets better — softer and more characterful with every wash.</p>
          <ul className={styles.steps}>
            <li>
              <span className={styles.stepLabel}>Wash</span>
              <span><strong>Machine wash cool to warm (up to 40°C) on a gentle cycle.</strong> A mild detergent is all it needs. Wash with like colours, and avoid over-loading so it can move freely.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Dry</span>
              <span><strong>Line dry, or tumble on low and remove while still slightly damp.</strong> Linen relaxes as it dries — a gentle shake helps it hang naturally.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Press</span>
              <span><strong>Iron on medium-high while damp</strong> for a crisp finish — or leave it to air for a softer, lived-in look. Both are right; it’s a matter of mood.</span>
            </li>
            <li>
              <span className={styles.stepLabel}>Store</span>
              <span><strong>Fold and store in a dry, airy place.</strong> Linen loves to breathe, so skip the plastic. Its natural creases are part of the charm.</span>
            </li>
          </ul>
          <p className={styles.avoid}>
            <strong>Best avoided:</strong> bleach, fabric softener (it dulls linen’s natural
            texture), and very hot washes. A little softness comes with time, not chemicals.
          </p>
        </section>

        <p className={styles.closing}>
          Cared for gently, these are pieces to keep for years — quietly becoming more yours
          with every season.
        </p>
        <p className={styles.wordmark}>SILKILINEN</p>
      </div>
    </main>
  );
}
