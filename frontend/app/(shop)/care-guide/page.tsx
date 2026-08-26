import Link from 'next/link';
import { categoryPath } from '@/lib/urls';
import { CARE_GUIDE_CATEGORIES } from '@/lib/categoryContent';
import { apiList } from '@/lib/apiFetch';
import styles from './page.module.css';
import PrintButton from './PrintButton';
import { SITE } from '@/lib/i18n';

export const metadata = {
  alternates: { canonical: `${SITE}/care-guide` },
  title: 'Silk & Linen Care Guide',
  description: 'How to wash, dry, press and store mulberry silk and European linen so it lasts for years — SILKILINEN’s downloadable care guide.',
};

// Filtered against the LIVE list before rendering: the shop 404s a category
// with no products in it — deliberately, to keep thin pages out of the index —
// so a fixed link here would become a broken link on an education page the
// moment a shelf emptied. Silent if the API is unreachable; a missing row of
// links is a smaller failure than a row of dead ones.
type Cat = { slug: string; label: string; count: number };

async function getOnwardCategories(): Promise<Cat[]> {
  const all = await apiList<Cat>(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
    next: { revalidate: 300 },
  });
  const live = new Map(all.filter(c => c.count > 0).map(c => [c.slug, c]));
  return CARE_GUIDE_CATEGORIES.map(slug => live.get(slug)).filter((c): c is Cat => Boolean(c));
}

export default async function CareGuidePage() {
  const onward = await getOnwardCategories();
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

        {/* §49 asks this page to link to products, and it linked nowhere at all
            — a dead end at the exact moment a reader has just been told the
            upkeep is manageable. Deliberately kept off the printed sheet
            (styles.noPrint): a page of URLs is not what someone wants folded in
            a drawer next to the washing machine.

            Categories, not individual pieces: a care page outlives any product
            that happens to be in stock the week it was written, and a link to a
            sold-out robe is a worse dead end than none. Built through the URL
            owner, from the live category list — see getOnwardCategories. */}
        <nav className={`${styles.onward} ${styles.noPrint}`} aria-label="Continue browsing">
          <p className={styles.onwardLabel}>The pieces this was written for</p>
          <ul className={styles.onwardList}>
            {onward.map(c => (
              <li key={c.slug}><Link href={categoryPath(c.slug)}>{c.label} →</Link></li>
            ))}
            <li><Link href="/silk-standard">What makes silk worth it →</Link></li>
          </ul>
        </nav>

        <p className={styles.wordmark}>SILKILINEN</p>
      </div>
    </main>
  );
}
