'use client';

import { useRouter } from 'next/navigation';
import styles from './AdminLayout.module.css';

const API = 'https://silkilinen-production.up.railway.app';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/admin/login');
  }

  return (
    <button onClick={handleLogout} className={styles.logout}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Sign out
    </button>
  );
}
