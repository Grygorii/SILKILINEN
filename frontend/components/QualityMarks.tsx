import { mommeReading, fibreLabel } from '@/lib/fabricCare';
import { localeHref, type PageLocale } from '@/lib/i18n';
import styles from './QualityMarks.module.css';

const MOMME_GUIDE = '/journal/what-momme-weight-means-in-silk-and-how-to-judge-quality-before-you-buy';

export default function QualityMarks({
  composition,
  momme,
  locale,
}: {
  composition?: string;
  momme?: string;
  locale: PageLocale;
}) {
  const weight = mommeReading(momme, composition);
  const fibre = fibreLabel(composition);
  if (!fibre && !weight) return null;

  return (
    <p className={styles.marks}>
      {fibre && <span>{fibre}</span>}
      {weight && (
        <span className={styles.weight}>
          {fibre && <span aria-hidden="true">·</span>}
          <a className={styles.weightLink} href={localeHref(locale, MOMME_GUIDE)} target="_blank" rel="noopener noreferrer">
            {weight.value} momme
          </a>
        </span>
      )}
    </p>
  );
}
