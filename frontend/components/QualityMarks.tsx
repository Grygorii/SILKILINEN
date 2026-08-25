import { mommeReading } from '@/lib/fabricCare';
import styles from './QualityMarks.module.css';

// The one-line answer to "why does this cost this", placed where the question
// is actually asked — directly under the price.
//
// The full fabric story already exists further down the page, but it is inside
// a collapsed accordion, and a customer reading €168 does not scroll three
// sections and open a panel before deciding whether the number is reasonable.
// They decide at the price. This is the same facts, one line, at that moment.
//
// Facts only, and only ones this product actually carries. Every mark here is
// read from the record: the momme is the stored measurement, the composition is
// what the founder typed. Nothing is inferred and nothing is padded to make the
// row look fuller — a row of four marks where one is invented is worth less
// than a row of one that is true, because the invented one is the one a
// knowledgeable buyer checks.
//
// "Designed in Ireland" is the only fixed mark. It is true of every piece
// however it is sourced (ADR 0008), which is precisely why it can sit here
// unconditionally where a manufacture claim could not.
export default function QualityMarks({
  composition,
  momme,
}: {
  composition?: string;
  momme?: string;
}) {
  const weight = mommeReading(momme, composition);

  // Trimmed short: this is a mark, not the composition paragraph. The full
  // string is in the Fabric & care panel below.
  const fibre = /mulberry/i.test(composition || '') ? 'Pure Mulberry silk'
    : /silk/i.test(composition || '') ? 'Pure silk'
    : /linen/i.test(composition || '') ? 'Pure linen'
    : null;

  const marks = [
    fibre,
    weight ? `${weight.value} momme` : null,
    'Designed in Ireland',
  ].filter(Boolean) as string[];

  // With no fabric detail recorded the row would be a single fixed mark
  // floating under the price, which reads as a slogan rather than a spec.
  if (marks.length < 2) return null;

  return (
    <p className={styles.marks}>
      {marks.map((m, i) => (
        <span key={m} className={styles.mark}>
          {i > 0 && <span className={styles.sep} aria-hidden="true">·</span>}
          {m}
        </span>
      ))}
    </p>
  );
}
