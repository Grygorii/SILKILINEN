import styles from './page.module.css';

export const metadata = {
  title: 'Payment Cancelled — SILKILINEN',
  description: 'Your payment was cancelled. No charge was made. Return to the shop whenever you are ready.',
};

export default function CancelPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.icon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1>Payment cancelled</h1>
        <p>No charge was made. Your cart is still saved — head back whenever you are ready.</p>
        <a href="/shop" className={styles.btn}>Return to shop</a>
      </div>
    </main>
  );
}
