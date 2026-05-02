'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomer } from '@/context/CustomerContext';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useCustomer();
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setError('No token provided.'); return; }

    fetch(`${API}/api/customers/verify-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(async ({ ok, data }) => {
        if (!ok) { setStatus('error'); setError(data.error || 'Link expired or already used.'); return; }
        await refresh();
        router.replace(data.isFirstLogin ? '/account?welcome=1' : '/account');
      })
      .catch(() => { setStatus('error'); setError('Something went wrong. Please try again.'); });
  }, [searchParams, refresh, router]);

  return (
    <div className={styles.page}>
      {status === 'verifying' ? (
        <>
          <div className={styles.spinner} />
          <p className={styles.msg}>Signing you in…</p>
        </>
      ) : (
        <>
          <p className={styles.errorIcon}>✕</p>
          <p className={styles.errorTitle}>Sign-in failed</p>
          <p className={styles.errorMsg}>{error}</p>
          <a href="/account/sign-in" className={styles.retryBtn}>Try again</a>
        </>
      )}
    </div>
  );
}
