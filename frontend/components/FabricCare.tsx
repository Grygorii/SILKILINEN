import Link from 'next/link';
import { careSteps, mommeReading, hasFabricDetail, type CareIcon } from '@/lib/fabricCare';
import styles from './FabricCare.module.css';

// The fabric section of the PDP: what it is made of, what it weighs, and how to
// keep it. A server component — nothing here is interactive, and the PDP has no
// bundle budget to spend on a list of laundry symbols.
//
// It replaced three sub-headings and three paragraphs that read like a shipping
// disclaimer. The two changes that matter: the momme figure is shown against
// the scale it needs to mean anything, and care is a list of instructions
// rather than a run-on sentence a customer skims and then guesses at.

// ISO 3758, which is the same set printed inside the garment — a tub for
// washing, a triangle for bleach, a square for drying, an iron for ironing, a
// circle for dry cleaning. Drawn at the accordion chevron's weight so they read
// as part of the page rather than as clip art.
function CareGlyph({ icon }: { icon: CareIcon }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (icon) {
    case 'wash':
      return <svg {...common}><path d="M2 6.5h12v4a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 10.5v-4Z" /><path d="M4.5 6.5 6 3.2a1.4 1.4 0 0 1 2.2-.4" /></svg>;
    case 'bleach':
      return <svg {...common}><path d="M8 2.8 14 13H2L8 2.8Z" /></svg>;
    case 'dry':
      return <svg {...common}><rect x="2.5" y="2.5" width="11" height="11" rx="0.5" /><circle cx="8" cy="8" r="3" /></svg>;
    case 'iron':
      return <svg {...common}><path d="M2 11.5h12l-1.6-5.2a2 2 0 0 0-1.9-1.4H5.6a3.6 3.6 0 0 0-3.6 3.6v3Z" /></svg>;
    case 'dryClean':
      return <svg {...common}><circle cx="8" cy="8" r="5.5" /></svg>;
    default:
      // Anything the rule could not classify still gets a marker, because the
      // alternative — dropping it — is how a customer ruins the garment.
      return <svg {...common}><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></svg>;
  }
}

export default function FabricCare({
  composition,
  momme,
  care,
}: {
  composition?: string;
  momme?: string;
  care?: string;
}) {
  if (!hasFabricDetail({ materialComposition: composition, momme, careInstructions: care })) return null;

  const weight = mommeReading(momme, composition);
  const { steps, general } = careSteps(care, composition);

  return (
    <div className={styles.root}>
      {composition && (
        <section className={styles.block}>
          <h3 className={styles.label}>Composition</h3>
          <p className={styles.value}>{composition}</p>
        </section>
      )}

      {weight && (
        <section className={styles.block}>
          <h3 className={styles.label}>Weight</h3>
          <p className={styles.momme}>
            <span className={styles.mommeValue}>{weight.value}</span>
            <span className={styles.mommeUnit}>momme</span>
            <span className={styles.mommeBand}>{weight.band}</span>
          </p>
          {/* Decorative: every fact the bar encodes is already in the text
              above and below it, so a screen reader gains nothing by walking
              a div with a percentage on it. */}
          <div className={styles.scale} aria-hidden="true">
            <div className={styles.scaleLine} />
            <div className={styles.scaleMark} style={{ left: `${weight.position * 100}%` }} />
          </div>
          <div className={styles.scaleEnds} aria-hidden="true">
            <span>Light</span>
            <span>Heavyweight</span>
          </div>
          <p className={styles.note}>{weight.note}</p>
          {/* The number is stated here; what it means in general is one page
              away, rather than repeated on every product. */}
          <p className={styles.note}>
            <Link href="/silk-standard" className={styles.link}>How silk weight is measured →</Link>
          </p>
        </section>
      )}

      {steps.length > 0 && (
        <section className={styles.block}>
          <h3 className={styles.label}>Care</h3>
          <ul className={styles.care}>
            {steps.map((s, i) => (
              <li key={i} className={styles.careStep}>
                <span className={styles.glyph}><CareGlyph icon={s.icon} /></span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
          {general && (
            // Said out loud, because the difference between "how to care for
            // silk" and "how to care for THIS" is exactly the kind of thing a
            // premium buyer is entitled to know we are distinguishing.
            <p className={styles.note}>General guidance for this fabric. Any garment-specific instruction is on the care label.</p>
          )}
        </section>
      )}
    </div>
  );
}
