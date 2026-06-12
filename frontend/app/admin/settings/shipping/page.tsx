'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminErrorBanner from '@/components/AdminErrorBanner';
import { toast } from '@/lib/adminToast';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Rates = { cost: number; freeThreshold: number; deliveryMin: number; deliveryMax: number };
type Tier = { label: string; countries: string[] | null; defaults: Rates; effective: Rates };

const FIELD_LABELS: { key: keyof Rates; label: string; prefix?: string; suffix?: string }[] = [
  { key: 'cost', label: 'Cost', prefix: '€' },
  { key: 'freeThreshold', label: 'Free over', prefix: '€' },
  { key: 'deliveryMin', label: 'Delivery min', suffix: 'days' },
  { key: 'deliveryMax', label: 'Delivery max', suffix: 'days' },
];

/**
 * Shipping-rate editor — the rates used live at checkout. Country membership
 * of each tier stays in code (structural); costs, free-shipping thresholds
 * and delivery windows are editable here. Saving takes effect immediately.
 */
export default function ShippingSettingsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  // edits[label][field] = string as typed; '' = keep default
  const [edits, setEdits] = useState<Record<string, Partial<Record<keyof Rates, string>>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/shipping-rates`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTiers(data.tiers || []);
      // Seed the form with effective values so what you see is what's live.
      const seeded: typeof edits = {};
      for (const t of data.tiers || []) {
        seeded[t.label] = {
          cost: String(t.effective.cost),
          freeThreshold: String(t.effective.freeThreshold),
          deliveryMin: String(t.effective.deliveryMin),
          deliveryMax: String(t.effective.deliveryMax),
        };
      }
      setEdits(seeded);
    } catch {
      setError('Could not load shipping rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setField(label: string, key: keyof Rates, value: string) {
    setEdits(prev => ({ ...prev, [label]: { ...prev[label], [key]: value } }));
  }

  async function save() {
    // Build overrides: only send fields that differ from the code default.
    const overrides: Record<string, Partial<Rates>> = {};
    for (const t of tiers) {
      const e = edits[t.label] || {};
      const entry: Partial<Rates> = {};
      for (const { key } of FIELD_LABELS) {
        const raw = e[key];
        if (raw === undefined || raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          toast(`${t.label}: ${key} must be a non-negative number.`, 'error');
          return;
        }
        if (n !== t.defaults[key]) entry[key] = n;
      }
      if ((entry.deliveryMin ?? t.defaults.deliveryMin) > (entry.deliveryMax ?? t.defaults.deliveryMax)) {
        toast(`${t.label}: delivery min cannot exceed max.`, 'error');
        return;
      }
      if (Object.keys(entry).length > 0) overrides[t.label] = entry;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/shipping-rates`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ overrides }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Save failed.', 'error'); return; }
      toast('Shipping rates saved — live at checkout now.');
      setTiers(data.tiers || []);
    } catch {
      toast('Network error.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm('Reset all rates to the code defaults?')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/shipping-rates/reset`, {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': '1' },
      });
      if (!res.ok) { toast('Reset failed.', 'error'); return; }
      toast('Rates reset to defaults.');
      await load();
    } catch {
      toast('Network error.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout active="settings">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Shipping rates</h2>
          <p className={styles.subtitle}>These rates are used live at checkout. Changes apply immediately after saving.</p>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.resetBtn} onClick={reset} disabled={saving || loading}>Reset to defaults</button>
          <button className={styles.saveBtn} onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </div>
      </div>

      {error && <AdminErrorBanner error={error} onRetry={load} />}
      {loading && <p className={styles.muted}>Loading rates…</p>}

      {!loading && tiers.map(t => {
        const changed = FIELD_LABELS.some(({ key }) => {
          const raw = edits[t.label]?.[key];
          return raw !== undefined && raw !== '' && Number(raw) !== t.defaults[key];
        });
        return (
          <section key={t.label} className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.tierName}>{t.label}</h3>
              {changed && <span className={styles.customPill}>custom</span>}
            </div>
            <p className={styles.countries}>
              {t.countries ? t.countries.join(', ') : 'Everywhere not covered by a tier above'}
            </p>
            <div className={styles.fields}>
              {FIELD_LABELS.map(({ key, label, prefix, suffix }) => (
                <label key={key} className={styles.field}>
                  <span className={styles.fieldLabel}>{label}</span>
                  <span className={styles.inputWrap}>
                    {prefix && <span className={styles.affix}>{prefix}</span>}
                    <input
                      type="number"
                      min={0}
                      step={key === 'cost' || key === 'freeThreshold' ? '0.01' : '1'}
                      value={edits[t.label]?.[key] ?? ''}
                      onChange={e => setField(t.label, key, e.target.value)}
                      className={styles.numInput}
                    />
                    {suffix && <span className={styles.affix}>{suffix}</span>}
                  </span>
                  <span className={styles.defaultNote}>default {prefix || ''}{t.defaults[key]}{suffix ? ` ${suffix}` : ''}</span>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </AdminLayout>
  );
}
