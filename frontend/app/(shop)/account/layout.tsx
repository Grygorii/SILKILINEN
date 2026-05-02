'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomer } from '@/context/CustomerContext';
import styles from './account.module.css';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { customer, loading } = useCustomer();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !customer) {
      router.replace('/account/sign-in');
    }
  }, [customer, loading, router]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!customer) return null;

  return <div className={styles.container}>{children}</div>;
}
