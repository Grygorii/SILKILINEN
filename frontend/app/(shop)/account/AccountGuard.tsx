'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCustomer } from '@/context/CustomerContext';
import styles from './account.module.css';

const PUBLIC_PATHS = ['/account/sign-in', '/account/verify'];

// The auth gate, lifted out of layout.tsx unchanged. A layout that is a client
// component cannot export `metadata`, and this whole tree needed a noindex —
// so the layout became a server component and the browser-side work moved here.
export default function AccountGuard({ children }: { children: React.ReactNode }) {
  const { customer, loading } = useCustomer();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!isPublic && !loading && !customer) {
      router.replace('/account/sign-in');
    }
  }, [customer, loading, router, isPublic]);

  // Sign-in and verify pages render without any auth check
  if (isPublic) return <>{children}</>;

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!customer) return null;

  return <div className={styles.container}>{children}</div>;
}
