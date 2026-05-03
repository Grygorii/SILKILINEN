'use client';

import { useRouter } from 'next/navigation';
import styles from './AdminLayout.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    // Clear Railway-domain cookie (for client-side API calls)
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    // Clear Vercel-domain cookie (for middleware + layout)
    await fetch('/api/admin-session', { method: 'DELETE' });
    window.location.href = '/admin/login';
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
