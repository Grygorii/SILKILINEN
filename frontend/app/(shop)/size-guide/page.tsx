import styles from '../legal.module.css';
import SizeChartTable from '@/components/SizeChartTable';
import { fetchSizeRows } from '@/lib/sizeChart';
import { getSiteSettings } from '@/lib/settings';
import { SITE } from '@/lib/i18n';

export const metadata = {
  alternates: { canonical: `${SITE}/size-guide` },
  title: 'Size Guide',
  description: 'Find your perfect fit with the SILKILINEN size guide. Measurements in cm and inches for all our silk and linen pieces.',
};

export default async function SizeGuidePage() {
  const [rows, { supportEmail }] = await Promise.all([fetchSizeRows(), getSiteSettings()]);
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
          <SizeChartTable rows={rows} />
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
