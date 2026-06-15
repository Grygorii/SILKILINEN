import styles from '../legal.module.css';
import tableStyles from './page.module.css';
import { getSiteSettings } from '@/lib/settings';

export const metadata = {
  alternates: { canonical: 'https://www.silkilinen.com/size-guide' },
  title: 'Size Guide',
  description: 'Find your perfect fit with the SILKILINEN size guide. Measurements in cm and inches for all our silk and linen pieces.',
};

type Row = { size: string; eu: string; uk: string; bustCm: string; bustIn: string; waistCm: string; waistIn: string; hipCm: string; hipIn: string };

const FALLBACK_ROWS: Row[] = [
  { size: 'XS', eu: '34', uk: '8',  bustCm: '80–84',  bustIn: '31.5–33',  waistCm: '62–66', waistIn: '24.5–26', hipCm: '88–92',   hipIn: '34.5–36' },
  { size: 'S',  eu: '36', uk: '10', bustCm: '84–88',  bustIn: '33–34.5',  waistCm: '66–70', waistIn: '26–27.5', hipCm: '92–96',   hipIn: '36–38' },
  { size: 'M',  eu: '38', uk: '12', bustCm: '88–92',  bustIn: '34.5–36',  waistCm: '70–74', waistIn: '27.5–29', hipCm: '96–100',  hipIn: '38–39.5' },
  { size: 'L',  eu: '40', uk: '14', bustCm: '92–96',  bustIn: '36–38',    waistCm: '74–78', waistIn: '29–30.5', hipCm: '100–104', hipIn: '39.5–41' },
  { size: 'XL', eu: '42', uk: '16', bustCm: '96–100', bustIn: '38–39.5',  waistCm: '78–82', waistIn: '30.5–32', hipCm: '104–108', hipIn: '41–42.5' },
];

async function getRows(): Promise<Row[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/size-chart`, { next: { revalidate: 300 } });
    if (!res.ok) return FALLBACK_ROWS;
    const data = await res.json();
    return Array.isArray(data.rows) && data.rows.length ? data.rows : FALLBACK_ROWS;
  } catch {
    return FALLBACK_ROWS;
  }
}

export default async function SizeGuidePage() {
  const [rows, { supportEmail }] = await Promise.all([getRows(), getSiteSettings()]);
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Size Guide</h1>
          <p>All measurements are given in centimetres and inches. If you are between sizes, we recommend sizing up.</p>
        </header>

        <section className={styles.section}>
          <h2>How to measure yourself</h2>
          <ul>
            <li><strong>Bust</strong> — Measure around the fullest part of your chest, keeping the tape parallel to the floor.</li>
            <li><strong>Waist</strong> — Measure around your natural waist, the narrowest part of your torso.</li>
            <li><strong>Hips</strong> — Measure around the fullest part of your hips and bottom, approximately 20 cm below your waist.</li>
          </ul>
          <p>Use a soft measuring tape and take measurements over your underwear for the most accurate result.</p>
        </section>

        <section className={styles.section}>
          <h2>Size chart</h2>
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>EU</th>
                  <th>UK</th>
                  <th>Bust (cm)</th>
                  <th>Bust (in)</th>
                  <th>Waist (cm)</th>
                  <th>Waist (in)</th>
                  <th>Hips (cm)</th>
                  <th>Hips (in)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.size}>
                    <td><strong>{r.size}</strong></td>
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
        </section>

        <section className={styles.section}>
          <h2>Garment fit notes</h2>
          <ul>
            <li><strong>Robes</strong> — Cut for a relaxed, oversized fit. If you prefer a more fitted look, size down.</li>
            <li><strong>Slips & dresses</strong> — True to size with a slight ease for comfort. Measure your bust first.</li>
            <li><strong>Sets</strong> — Sized by the larger measurement. Mix and match tops and bottoms if needed.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Still unsure?</h2>
          <p>
            Email us at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and we will help
            you find the right fit. Include your measurements and the item you are interested in.
          </p>
        </section>
      </div>
    </main>
  );
}
