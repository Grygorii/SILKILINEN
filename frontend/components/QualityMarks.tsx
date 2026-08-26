import { Fragment } from 'react';
import { mommeReading, fibreLabel } from '@/lib/fabricCare';
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
  // string is in the Fabric & care panel below. Shared with ProductCard, so the
  // grid and the page cannot describe the same garment two different ways.
  const fibre = fibreLabel(composition);

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
        <Fragment key={m}>
          {/* The separator is a SIBLING of the marks, not the first child of
              one. Inside the span it travelled with the mark when the row
              wrapped, so a three-mark line on a phone broke as
              "… 19 MOMME" / "· DESIGNED IN IRELAND" — an orphaned dot opening
              the second line. The stylesheet claimed to have solved this by
              padding the separator instead of gapping the row; that was the
              right idea applied to the wrong element. */}
          {i > 0 && <span className={styles.sep} aria-hidden="true">·</span>}
          <span className={styles.mark}>{m}</span>
        </Fragment>
      ))}
    </p>
  );
}
