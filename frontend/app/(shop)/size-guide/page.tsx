import styles from '../legal.module.css';
import tableStyles from './page.module.css';

export const metadata = {
  title: 'Size Guide — SILKILINEN',
  description: 'Find your perfect fit with the SILKILINEN size guide. Measurements in cm and inches for all our silk and linen pieces.',
};

export default function SizeGuidePage() {
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
                <tr>
                  <td><strong>XS</strong></td>
                  <td>34</td>
                  <td>8</td>
                  <td>80–84</td>
                  <td>31.5–33</td>
                  <td>62–66</td>
                  <td>24.5–26</td>
                  <td>88–92</td>
                  <td>34.5–36</td>
                </tr>
                <tr>
                  <td><strong>S</strong></td>
                  <td>36</td>
                  <td>10</td>
                  <td>84–88</td>
                  <td>33–34.5</td>
                  <td>66–70</td>
                  <td>26–27.5</td>
                  <td>92–96</td>
                  <td>36–38</td>
                </tr>
                <tr>
                  <td><strong>M</strong></td>
                  <td>38</td>
                  <td>12</td>
                  <td>88–92</td>
                  <td>34.5–36</td>
                  <td>70–74</td>
                  <td>27.5–29</td>
                  <td>96–100</td>
                  <td>38–39.5</td>
                </tr>
                <tr>
                  <td><strong>L</strong></td>
                  <td>40</td>
                  <td>14</td>
                  <td>92–96</td>
                  <td>36–38</td>
                  <td>74–78</td>
                  <td>29–30.5</td>
                  <td>100–104</td>
                  <td>39.5–41</td>
                </tr>
                <tr>
                  <td><strong>XL</strong></td>
                  <td>42</td>
                  <td>16</td>
                  <td>96–100</td>
                  <td>38–39.5</td>
                  <td>78–82</td>
                  <td>30.5–32</td>
                  <td>104–108</td>
                  <td>41–42.5</td>
                </tr>
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
            Email us at <a href="mailto:hello@silkilinen.com">hello@silkilinen.com</a> and we will help
            you find the right fit. Include your measurements and the item you are interested in.
          </p>
        </section>
      </div>
    </main>
  );
}
