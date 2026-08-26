import Link from 'next/link';
import styles from './QualityBand.module.css';

// "Why SILKILINEN" — the quality band the homepage did not have.
//
// ReassuranceRow already answers "is this shop safe to buy from" (shipping,
// returns, gift wrap). Nothing answered the question a €168 robe actually
// provokes, which is "why does this cost what it costs". Logistics trust and
// product trust are different jobs and this band is the second one.
//
// Every pillar here is a fact the brand can stand behind however a piece is
// sourced. That constraint is the point, not a limitation: SILKILINEN is
// Irish-FOUNDED and the pieces are DESIGNED in Donegal, both true of a garment
// manufactured abroad, where "crafted in Ireland" is not (origin is mixed —
// ADR 0008). Anything about a factory would be a claim we cannot keep, and a
// claim that has to be withdrawn later is worth less than the one it replaced.
//
// Deliberately not here: OEKO-TEX. It appears on the About page and twice in
// the FAQ and nobody has produced the certificate, so it is not going on the
// homepage until someone has. Same rule as momme — a standard is a fact or it
// is decoration.
const PILLARS = [
  {
    label: 'Pure Mulberry silk',
    body: 'Long-fibre mulberry silk and European linen. Nothing synthetic, nothing blended to cut cost.',
  },
  {
    label: 'Designed in Ireland',
    body: 'Every piece is drawn and specified in Donegal — colour, weight, cut and finish decided here.',
  },
  {
    label: 'Weight you can feel',
    body: 'Silk is sold by momme. Ours is stated on every product page, because a number you can check beats an adjective.',
  },
  {
    label: 'Shipped from Ireland',
    body: 'Sent from Donegal worldwide, wrapped for giving, with 14 days to change your mind.',
  },
];

export default function QualityBand() {
  return (
    <section className={styles.section} aria-labelledby="why-silkilinen">
      <h2 id="why-silkilinen" className={styles.title}>Why SILKILINEN</h2>
      <ul className={styles.grid}>
        {PILLARS.map(p => (
          <li key={p.label} className={styles.pillar}>
            <h3 className={styles.label}>{p.label}</h3>
            <p className={styles.body}>{p.body}</p>
          </li>
        ))}
      </ul>
      <p className={styles.more}>
        <Link href="/silk-standard" className={styles.moreLink}>What makes silk worth it →</Link>
      </p>
    </section>
  );
}
