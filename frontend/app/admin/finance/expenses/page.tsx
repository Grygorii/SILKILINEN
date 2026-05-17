'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

const CATEGORIES = [
  ['shipping_per_order', 'Shipping / order'],
  ['materials_silk',     'Silk materials'],
  ['materials_linen',    'Linen materials'],
  ['materials_other',    'Other materials'],
  ['packaging',          'Packaging'],
  ['software_saas',      'Software / SaaS'],
  ['marketing_ads',      'Marketing ads'],
  ['marketing_tools',    'Marketing tools'],
  ['professional_fees',  'Professional fees'],
  ['studio_workspace',   'Studio / workspace'],
  ['equipment',          'Equipment'],
  ['bank_payment_fees',  'Bank fees'],
  ['tax_vat',            'VAT'],
  ['refunds',            'Refunds'],
  ['other',              'Other'],
] as const;

type Expense = {
  _id: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  notes?: string;
  isAutomatic?: boolean;
  receiptId?: { _id: string; fileUrl: string; fileName: string };
  createdAt: string;
};

type AddForm = {
  amount: string; date: string; category: string; description: string;
  notes: string; isRecurring: boolean; taxDeductible: boolean;
};

const EMPTY_FORM: AddForm = {
  amount: '', date: new Date().toISOString().slice(0, 10),
  category: 'software_saas', description: '',
  notes: '', isRecurring: false, taxDeductible: true,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FinanceExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [yearTotal, setYearTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (categoryFilter) params.set('category', categoryFilter);
    if (search) params.set('search', search);
    if (fromDate) params.set('from', fromDate);
    if (toDate)   params.set('to', toDate);
    try {
      const res = await fetch(`${API}/api/admin/finance/expenses?${params}`, { credentials: 'include' });
      const d = await res.json();
      setExpenses(d.expenses || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setYearTotal(d.yearTotal || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, categoryFilter, search, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveErr('');
    setShowModal(true);
  }

  function openEdit(e: Expense) {
    if (e.isAutomatic) return;
    setEditingId(e._id);
    setForm({
      amount: e.amount.toString(),
      date: e.date.slice(0, 10),
      category: e.category,
      description: e.description,
      notes: e.notes || '',
      isRecurring: false,
      taxDeductible: true,
    });
    setSaveErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.amount || !form.category || !form.description) {
      setSaveErr('Amount, category, and description are required.');
      return;
    }
    setSaving(true);
    setSaveErr('');
    try {
      const url = editingId
        ? `${API}/api/admin/finance/expenses/${editingId}`
        : `${API}/api/admin/finance/expenses`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (!res.ok) { setSaveErr((await res.json()).error || 'Save failed'); return; }
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    await fetch(`${API}/api/admin/finance/expenses/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  const catLabel = (slug: string) => CATEGORIES.find(([s]) => s === slug)?.[1] || slug;

  return (
    <AdminLayout active="finance">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Expenses</h1>
        </div>
        <p className={styles.sub}>{total} entries · €{yearTotal.toFixed(2)} total this year</p>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={openAdd}>+ Add expense</button>
        </div>

        <div className={styles.filters}>
          <input
            className={styles.filterInput}
            type="text"
            placeholder="Search description…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
          <select className={styles.filterSelect} value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
          <input className={styles.filterInput} type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
          <input className={styles.filterInput} type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
          {(categoryFilter || search || fromDate || toDate) && (
            <button className={styles.clearBtn} onClick={() => { setCategoryFilter(''); setSearch(''); setSearchInput(''); setFromDate(''); setToDate(''); setPage(1); }}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <div className={styles.tableWrap}>
            {expenses.length === 0 ? (
              <p className={styles.empty}>No expenses found.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Receipt</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e._id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                      <td>{catLabel(e.category)}{e.isAutomatic && <span className={styles.autoTag}>auto</span>}</td>
                      <td>
                        {e.description}
                        {e.notes && <span style={{ color: '#aaa', fontSize: 11, display: 'block' }}>{e.notes}</span>}
                      </td>
                      <td>
                        {e.receiptId ? (
                          <a href={e.receiptId.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.receiptLink}>
                            📎 {e.receiptId.fileName || 'Receipt'}
                          </a>
                        ) : '—'}
                      </td>
                      <td className={styles.amountCol}>€{e.amount.toFixed(2)}</td>
                      <td>
                        {!e.isAutomatic && (
                          <div className={styles.rowActions}>
                            <button className={styles.actionBtn} onClick={() => openEdit(e)}>Edit</button>
                            <button className={styles.actionBtnDanger} onClick={() => handleDelete(e._id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {pages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className={styles.pageInfo}>Page {page} of {pages}</span>
            <button className={styles.pageBtn} disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>{editingId ? 'Edit expense' : 'Add expense'}</p>

            <label className={styles.modalLabel}>Amount (€) *</label>
            <input className={styles.modalInput} type="number" step="0.01" min="0" autoFocus value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />

            <label className={styles.modalLabel}>Date *</label>
            <input className={styles.modalInput} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

            <label className={styles.modalLabel}>Category *</label>
            <select className={styles.modalSelect} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
            </select>

            <label className={styles.modalLabel}>Description *</label>
            <input className={styles.modalInput} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Cloudinary monthly subscription" />

            <label className={styles.modalLabel}>Notes (optional)</label>
            <textarea className={styles.modalTextarea} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Longer context or notes" />

            <div className={styles.modalToggleRow}>
              <input type="checkbox" id="taxDeductible" checked={form.taxDeductible} onChange={e => setForm(f => ({ ...f, taxDeductible: e.target.checked }))} />
              <label htmlFor="taxDeductible">Tax deductible</label>
            </div>

            {saveErr && <p className={styles.modalErr}>{saveErr}</p>}

            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.modalSave} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
