import type { SizeRow } from '@/lib/sizeChart';
import styles from './SizeChartTable.module.css';

// The measurement table, rendered identically wherever it appears — the size
// guide page and the drawer on the product page.
//
// Presentational on purpose: no hooks, no fetching, so a server component and a
// client component can both use it. The alternative was the drawer carrying its
// own copy of nine columns, which is how the two would have come to disagree
// about what "M" means.
export default function SizeChartTable({ rows }: { rows: SizeRow[] }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Size</th>
            <th scope="col">EU</th>
            <th scope="col">UK</th>
            <th scope="col">Bust (cm)</th>
            <th scope="col">Bust (in)</th>
            <th scope="col">Waist (cm)</th>
            <th scope="col">Waist (in)</th>
            <th scope="col">Hips (cm)</th>
            <th scope="col">Hips (in)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.size}>
              <th scope="row">{r.size}</th>
              <td>{r.eu}</td>
              <td>{r.uk}</td>
              <td>{r.bustCm}</td>
              <td>{r.bustIn}</td>
              <td>{r.waistCm}</td>
              <td>{r.waistIn}</td>
              <td>{r.hipCm}</td>
              <td>{r.hipIn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
