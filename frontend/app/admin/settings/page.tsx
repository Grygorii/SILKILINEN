'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type AdminUser = {
  _id: string;
  email: string;
  role: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function SettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    fetch(`${API}/api/users`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setUsers(data.users ?? []);
        setCurrentUserId(data.currentUserId ?? '');
        setLoadingUsers(false);
      })
      .catch(() => setLoadingUsers(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create user');
        return;
      }
      setUsers(prev => [...prev, data]);
      setEmail('');
      setPassword('');
      setConfirm('');
      setFormSuccess(`Admin account created for ${data.email}`);
    } catch {
      setFormError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/api/users/${user._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete user');
        return;
      }
      setUsers(prev => prev.filter(u => u._id !== user._id));
    } catch {
      alert('Something went wrong');
    }
  }

  return (
    <AdminLayout active="settings">
      <div className={styles.header}>
        <h2>Settings</h2>
      </div>

      {/* ── Admin users ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Admin users</h3>

        {loadingUsers ? (
          <p className={styles.muted}>Loading…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>
                      {user.email}
                      {user._id === currentUserId && (
                        <span className={styles.youBadge}>you</span>
                      )}
                    </td>
                    <td>{user.role}</td>
                    <td>{user.createdAt ? formatDate(user.createdAt) : '—'}</td>
                    <td className={styles.actionCell}>
                      {user._id !== currentUserId && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Create new admin ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Add admin user</h3>

        <form onSubmit={handleCreate} className={styles.form}>
          {formError && <p className={styles.error}>{formError}</p>}
          {formSuccess && <p className={styles.success}>{formSuccess}</p>}

          <div className={styles.fields}>
            <div className={styles.field}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>
            <div className={styles.field}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
              />
            </div>
            <div className={styles.field}>
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Creating…' : 'Create admin account'}
          </button>
        </form>
      </section>
    </AdminLayout>
  );
}
