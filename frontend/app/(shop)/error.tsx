'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './error.module.css';

// Storefront error boundary. There was none anywhere in the app, so any runtime
// error in a client component fell through to Next's default screen — a bare
// "Application error: a client-side exception has occurred" on a luxury shop,
// with no way back except the browser's back button. That is a lost sale and a
// broken brand impression at the same time.
//
// Scoped to (shop) so the header, footer and cart survive: the customer keeps
// their cart and their navigation, and only the failed section is replaced.
//
// Deliberately NOT a retry loop. `reset()` re-renders the segment once; if the
// cause is persistent the customer gets the same screen rather than a spinner
// that never resolves, and the routes out are always visible.
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side errors arrive with only a digest — the message is withheld by
    // Next in production. Logging it client-side is what makes the digest
    // joinable to the server log when a customer reports a broken page.
    console.error('[storefront] render error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>
        Something went wrong
      </p>
      <h1 className={styles.title}>
        This part of the shop didn&rsquo;t load.
      </h1>
      <p className={styles.copy}>
        Your cart is safe. Try again, or carry on browsing — everything else is working.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={reset}
          className={styles.primaryAction}
        >
          Try again
        </button>
        <Link
          href="/shop"
          className={styles.secondaryAction}
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
