import type { UploadSpec } from '@/lib/uploadSpecs';
import styles from './UploadHint.module.css';

// Compact "what to upload" legend shown next to an upload field. Pass a spec from
// lib/uploadSpecs (or an inline one). Any field left undefined is simply omitted.
export default function UploadHint({ spec, title = 'Recommended' }: { spec: UploadSpec; title?: string }) {
  if (!spec) return null;
  const rows: Array<[string, string | undefined]> = [
    ['Size', spec.dimensions],
    ['Ratio', spec.aspect],
    ['Format', spec.formats],
    ['Max', spec.maxSize],
  ];
  return (
    <div className={styles.hint}>
      <p className={styles.title}>{title}</p>
      <div className={styles.row}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <span key={k} className={styles.pair}>
            <span className={styles.k}>{k}</span> <span className={styles.v}>{v}</span>
          </span>
        ))}
      </div>
      {spec.note && <p className={styles.note}>{spec.note}</p>}
    </div>
  );
}
