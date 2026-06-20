'use client';

import styles from './page.module.css';

// Save-as-PDF via the browser's print dialog — no PDF library, and the print
// stylesheet (page.module.css) strips the site chrome so the output is a clean,
// branded one/two-page guide.
export default function PrintButton() {
  return (
    <button className={styles.downloadBtn} onClick={() => window.print()}>
      ↓ Save as PDF
    </button>
  );
}
