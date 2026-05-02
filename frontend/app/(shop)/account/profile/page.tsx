'use client';

import { useState, useEffect } from 'react';
import { useCustomer } from '@/context/CustomerContext';
import styles from '../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ProfilePage() {
  const { customer, refresh } = useCustomer();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', marketingConsent: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      setForm({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
        marketingConsent: customer.marketingConsent || false,
      });
    }
  }, [customer]);

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch(`${API}/api/customers/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <a href="/account" className={styles.back}>← Back to account</a>
      <div className={styles.pageHeader}>
        <h1>Profile</h1>
        <p>{customer?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>First name</label>
            <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Last name</label>
            <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </div>
        </div>
        <div className={styles.field}>
          <label>Phone</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+353 87 000 0000" />
        </div>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={form.marketingConsent} onChange={e => set('marketingConsent', e.target.checked)} />
          Receive offers, new arrivals, and style updates by email
        </label>

        {error && <p className={styles.errorMsg}>{error}</p>}
        {saved && <p className={styles.successMsg}>✓ Changes saved</p>}

        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </>
  );
}
