'use client';

import { useState, useEffect } from 'react';
import { useCustomer } from '@/context/CustomerContext';
import styles from '../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

const EMPTY = { line1: '', line2: '', city: '', county: '', postcode: '', country: 'IE' };

export default function AddressesPage() {
  const { customer, refresh } = useCustomer();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer?.defaultShippingAddress) {
      setForm({ ...EMPTY, ...customer.defaultShippingAddress });
    }
  }, [customer]);

  function set(field: string, value: string) {
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
        body: JSON.stringify({ defaultShippingAddress: form }),
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
        <h1>Default shipping address</h1>
        <p>Used to pre-fill your details at checkout</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="line1">Address line 1</label>
          <input id="line1" name="line1" autoComplete="address-line1" type="text" value={form.line1} onChange={e => set('line1', e.target.value)} placeholder="12 Grafton Street" />
        </div>
        <div className={styles.field}>
          <label htmlFor="line2">Address line 2</label>
          <input id="line2" name="line2" autoComplete="address-line2" type="text" value={form.line2} onChange={e => set('line2', e.target.value)} placeholder="Apt 4" />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="city">City / Town</label>
            <input id="city" name="city" autoComplete="address-level2" type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Dublin" />
          </div>
          <div className={styles.field}>
            <label htmlFor="county">County</label>
            <input id="county" name="county" autoComplete="address-level1" type="text" value={form.county} onChange={e => set('county', e.target.value)} placeholder="Dublin" />
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="postcode">Postcode / Eircode</label>
            <input id="postcode" name="postcode" autoComplete="postal-code" type="text" value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="D02 VX39" />
          </div>
          <div className={styles.field}>
            <label htmlFor="country">Country</label>
            <select id="country" name="country" autoComplete="country-name" value={form.country} onChange={e => set('country', e.target.value)}>
              <option value="IE">Ireland</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="IT">Italy</option>
              <option value="ES">Spain</option>
              <option value="AU">Australia</option>
              <option value="CA">Canada</option>
            </select>
          </div>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}
        {saved && <p className={styles.successMsg}>✓ Address saved</p>}

        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'Saving…' : 'Save address'}
        </button>
      </form>
    </>
  );
}
