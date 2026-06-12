'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminErrorBanner from '@/components/AdminErrorBanner';
import { toast } from '@/lib/adminToast';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

type Product = {
  _id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  description?: string;
  status: 'draft' | 'active' | 'sold_out' | 'archived';
  totalStock: number;
  inStock: boolean;
  image?: string;
  images: { url: string; isPrimary?: boolean; alt?: string }[];
  variants: { _id: string; colour?: string; size?: string; sku?: string; stockLevel?: number }[];
  metaTitle?: string;
  costing?: { totalUnitCost?: number };
  updatedAt: string;
  createdAt: string;
};

type Category = { slug: string; label: string };

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', draft: 'Draft', sold_out: 'Sold out', archived: 'Archived',
};
const STATUS_CLASS: Record<string, string> = {
  active: styles.sActive, draft: styles.sDraft,
  sold_out: styles.sSoldOut, archived: styles.sArchived,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function thumb(p: Product) {
  const primary = p.images?.find(i => i.isPrimary);
  return primary?.url || p.images?.[0]?.url || p.image || '';
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IssuePills({ product }: { product: Product }) {
  const pills: string[] = [];
  if (!product.images?.length)   pills.push('No images');
  if (!product.variants?.length) pills.push('No variants');
  if (!product.metaTitle)        pills.push('No SEO');
  if (!product.description?.trim()) pills.push('No description');
  if (!pills.length) return null;
  return (
    <div className={styles.issuePills}>
      {pills.map(p => <span key={p} className={styles.issuePill}>{p}</span>)}
    </div>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (!product.variants?.length) return <span className={styles.stockMuted}>No variants</span>;
  if (product.totalStock === 0)  return <span className={`${styles.stockBadge} ${styles.skOut}`}>Out of stock</span>;
  if (product.totalStock < 5)    return <span className={`${styles.stockBadge} ${styles.skLow}`}>{product.totalStock} left</span>;
  return <span className={`${styles.stockBadge} ${styles.skIn}`}>{product.totalStock}</span>;
}

function InlinePriceEdit({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(product.price.toFixed(2));
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n < 0) { setPhase('error'); setTimeout(() => { setPhase('idle'); setEditing(false); }, 1500); return; }
    if (n === product.price) { setEditing(false); return; }
    setPhase('saving');
    try {
      const res = await fetch(`${API}/api/admin/products/${product._id}/quick-update`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ price: n }),
      });
      if (!res.ok) throw new Error();
      onUpdate(await res.json());
      setPhase('saved');
      setEditing(false);
      setTimeout(() => setPhase('idle'), 1500);
    } catch {
      setPhase('error');
      setTimeout(() => { setPhase('idle'); setEditing(false); }, 1500);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number" step="0.01" min="0"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className={styles.inlineInput}
        disabled={phase === 'saving'}
      />
    );
  }

  return (
    <button className={styles.inlineDisplay} onClick={() => { setValue(product.price.toFixed(2)); setEditing(true); }}>
      €{product.price.toFixed(2)}
      {phase === 'saved' && <span className={styles.inlineSaved}>✓</span>}
      {phase === 'error' && <span className={styles.inlineError}>✗</span>}
    </button>
  );
}

function InlineStatusEdit({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function pick(status: string) {
    setOpen(false);
    if (status === product.status) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/products/${product._id}/quick-update`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields?.length) {
          const missing = (data.fields as { label: string }[]).map(f => f.label).join(', ');
          setError(`Cannot publish — missing: ${missing}`);
        } else {
          setError(data.error || 'Failed');
        }
        return;
      }
      onUpdate(data);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.statusWrap}>
      <button
        className={`${styles.statusBadge} ${STATUS_CLASS[product.status] ?? ''} ${styles.statusClickable}`}
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        title={error || undefined}
      >
        {saving ? '…' : STATUS_LABEL[product.status] ?? product.status}
      </button>
      {open && (
        <div className={styles.statusDropdown}>
          {['draft', 'active', 'archived'].map(s => (
            <button key={s} onClick={() => pick(s)} className={styles.statusOption}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      {error && <span className={styles.statusError}>{error}</span>}
    </div>
  );
}

// Category as an inline dropdown — shows the LABEL (not the raw slug), and
// when a product still carries a stale slug from a renamed/deleted category
// (e.g. "home") it's flagged so the founder can fix it in one click without
// opening the product.
function InlineCategoryEdit({ product, categories, onUpdate }: {
  product: Product;
  categories: Category[];
  onUpdate: (p: Product) => void;
}) {
  const [saving, setSaving] = useState(false);
  const known = categories.find(c => c.slug === product.category);
  const stale = Boolean(product.category) && !known;

  async function pick(slug: string) {
    if (!slug || slug === product.category) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/products/${product._id}/quick-update`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ category: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data);
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : 'Could not change category', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      className={`${styles.categorySelect} ${stale ? styles.categoryStale : ''}`}
      value={known ? product.category : ''}
      onChange={e => pick(e.target.value)}
      disabled={saving}
      title={stale ? `"${product.category}" no longer exists — pick a category` : 'Change category'}
    >
      {stale && <option value="">⚠ {product.category} (missing)</option>}
      {!product.category && !stale && <option value="">No category</option>}
      {categories.map(c => (
        <option key={c.slug} value={c.slug}>{c.label}</option>
      ))}
    </select>
  );
}

// Stock, editable in place. Variantless products get a plain number input;
// products with variants get a popover listing each colour/size so the exact
// SKU can be restocked from the list (the model flips sold_out back to active
// automatically when stock returns).
function InlineStockEdit({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingSimple, setEditingSimple] = useState(false);
  const [simpleValue, setSimpleValue] = useState('');

  const hasVariants = (product.variants?.length || 0) > 0;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`${API}/api/admin/products/${product._id}/quick-update`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    onUpdate(data);
  }

  async function saveVariants() {
    const variantStock = product.variants
      .filter(v => levels[v._id] !== undefined && levels[v._id] !== '')
      .map(v => ({ _id: v._id, stockLevel: Number(levels[v._id]) }));
    if (variantStock.some(v => !Number.isFinite(v.stockLevel) || v.stockLevel < 0)) {
      toast('Stock must be a non-negative number.', 'error');
      return;
    }
    if (variantStock.length === 0) { setOpen(false); return; }
    setSaving(true);
    try {
      await patch({ variantStock });
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : 'Could not update stock', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSimple() {
    const n = Number(simpleValue);
    if (!Number.isFinite(n) || n < 0) { setEditingSimple(false); return; }
    if (n === product.totalStock) { setEditingSimple(false); return; }
    setSaving(true);
    try {
      await patch({ totalStock: n });
      setEditingSimple(false);
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : 'Could not update stock', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!hasVariants) {
    if (editingSimple) {
      return (
        <input
          type="number" min="0" autoFocus
          value={simpleValue}
          onChange={e => setSimpleValue(e.target.value)}
          onBlur={saveSimple}
          onKeyDown={e => { if (e.key === 'Enter') saveSimple(); if (e.key === 'Escape') setEditingSimple(false); }}
          className={styles.inlineInput}
          disabled={saving}
        />
      );
    }
    return (
      <button
        className={styles.inlineDisplay}
        onClick={() => { setSimpleValue(String(product.totalStock ?? 0)); setEditingSimple(true); }}
        title="Edit stock"
      >
        <StockBadge product={product} />
      </button>
    );
  }

  return (
    <div className={styles.statusWrap}>
      <button
        className={styles.inlineDisplay}
        onClick={() => {
          setLevels(Object.fromEntries(product.variants.map(v => [v._id, String(v.stockLevel ?? 0)])));
          setOpen(o => !o);
        }}
        title="Restock variants"
      >
        <StockBadge product={product} />
      </button>
      {open && (
        <div className={styles.stockPopover}>
          {product.variants.map(v => (
            <label key={v._id} className={styles.stockPopRow}>
              <span className={styles.stockPopLabel}>{[v.colour, v.size].filter(Boolean).join(' · ') || v.sku || 'Variant'}</span>
              <input
                type="number" min="0"
                value={levels[v._id] ?? ''}
                onChange={e => setLevels(prev => ({ ...prev, [v._id]: e.target.value }))}
                className={styles.stockPopInput}
              />
            </label>
          ))}
          <div className={styles.stockPopActions}>
            <button className={styles.stockPopCancel} onClick={() => setOpen(false)}>Cancel</button>
            <button className={styles.stockPopSave} onClick={saveVariants} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteModal({ product, onConfirm, onClose }: {
  product: Product;
  onConfirm: (confirmation: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Delete &ldquo;{product.name}&rdquo;?</h3>
        <p className={styles.modalBody}>
          This permanently deletes the product and cannot be undone.
        </p>
        <p className={styles.modalNote}>
          ⚠ If this product has order history it will be archived instead of deleted, to preserve records.
        </p>
        <label className={styles.modalLabel}>Type DELETE to confirm:</label>
        <input
          className={styles.modalInput}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoFocus
          placeholder="DELETE"
        />
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Cancel</button>
          <button
            className={styles.modalConfirm}
            disabled={typed !== 'DELETE'}
            onClick={() => onConfirm(typed)}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkBar({ count, onAction, onClear, loading, message, categories }: {
  count: number;
  onAction: (action: string, payload?: unknown) => void;
  onClear: () => void;
  loading: boolean;
  message: string;
  categories: Category[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState('10');

  if (count === 0) return null;

  return (
    <div className={styles.bulkBar}>
      <span className={styles.bulkCount}>{count} {count === 1 ? 'product' : 'products'} selected</span>
      <button className={styles.bulkClear} onClick={onClear}>Cancel</button>
      <div className={styles.bulkDivider} />

      {loading ? (
        <span className={styles.bulkMsg}>{message || 'Working…'}</span>
      ) : message ? (
        <span className={styles.bulkMsg}>{message}</span>
      ) : (
        <div className={styles.bulkActions}>
          <button className={styles.bulkBtn} onClick={() => onAction('publish')} disabled={loading}>Publish</button>
          <button className={styles.bulkBtn} onClick={() => onAction('archive')} disabled={loading}>Archive</button>

          <div style={{ position: 'relative' }}>
            <button className={styles.bulkBtn} onClick={() => setCatOpen(o => !o)}>Change category ▾</button>
            {catOpen && (
              <div className={styles.bulkDropdown}>
                {categories.map(c => (
                  <button key={c.slug} className={styles.bulkDropItem}
                    onClick={() => { setCatOpen(false); onAction('category', c.slug); }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button className={styles.bulkBtn} onClick={() => setDiscountOpen(o => !o)}>Apply discount ▾</button>
            {discountOpen && (
              <div className={styles.bulkDropdown} style={{ width: 200 }}>
                <div style={{ padding: '8px 12px' }}>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Discount %</label>
                  <input type="number" min="1" max="90" value={discountPct}
                    onChange={e => setDiscountPct(e.target.value)}
                    className={styles.bulkDiscountInput}
                  />
                  <button className={styles.bulkDiscountApply}
                    onClick={() => { setDiscountOpen(false); onAction('discount', parseFloat(discountPct)); }}>
                    Apply {discountPct}% off
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className={styles.bulkBtn} onClick={() => { setMenuOpen(false); onAction('export'); }}>Export CSV</button>
          <button className={`${styles.bulkBtn} ${styles.bulkBtnDelete}`} onClick={() => onAction('bulk-delete')}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [issuesFilter, setIssuesFilter] = useState('');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);

  // SEO bulk
  const [seoGenerating, setSeoGenerating] = useState(false);
  const [seoResult, setSeoResult] = useState('');
  const [seoConfirming, setSeoConfirming] = useState(false);

  // Inline action feedback (replaces alert() for archive/delete/export results)
  const [actionMessage, setActionMessage] = useState('');

  function showAction(msg: string) {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  }

  // Read URL params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q') || ''; setSearch(q); setSearchInput(q);
    setStatusFilter(p.get('status') || '');
    setCategoryFilter(p.get('category') || '');
    setStockFilter(p.get('stock') || '');
    setIssuesFilter(p.get('issues') || '');
    setSortField(p.get('sort') || 'updatedAt');
    setSortDir((p.get('dir') as 'asc' | 'desc') || 'desc');
    setPage(parseInt(p.get('page') || '1') || 1);
  }, []);

  // Fetch categories once
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => setCategories(data))
      .catch(() => {});
  }, []);

  // Load products
  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (stockFilter) params.set('stock', stockFilter);
    if (issuesFilter) params.set('issues', issuesFilter);
    params.set('sort', sortField);
    params.set('dir', sortDir);
    params.set('page', String(page));
    params.set('limit', '50');

    // Sync to URL
    const urlParams = new URLSearchParams();
    if (search) urlParams.set('q', search);
    if (statusFilter) urlParams.set('status', statusFilter);
    if (categoryFilter) urlParams.set('category', categoryFilter);
    if (stockFilter) urlParams.set('stock', stockFilter);
    if (issuesFilter) urlParams.set('issues', issuesFilter);
    if (sortField !== 'updatedAt') urlParams.set('sort', sortField);
    if (sortDir !== 'desc') urlParams.set('dir', sortDir);
    if (page > 1) urlParams.set('page', String(page));
    window.history.replaceState({}, '', `${window.location.pathname}${urlParams.toString() ? '?' + urlParams : ''}`);

    setLoadError('');
    fetch(`${API}/api/admin/products?${params}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        setProducts(Array.isArray(data) ? data : (data.products ?? []));
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setLoading(false);
      })
      .catch(err => {
        console.error('[products] load failed:', err);
        setLoadError('Could not load products. Check your connection and try again.');
        setLoading(false);
      });
  }, [search, statusFilter, categoryFilter, stockFilter, issuesFilter, sortField, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(prev => {
      const allSelected = products.every(p => prev.has(p._id));
      const next = new Set(prev);
      if (allSelected) products.forEach(p => next.delete(p._id));
      else products.forEach(p => next.add(p._id));
      return next;
    });
  }

  function updateProduct(updated: Product) {
    setProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
  }

  // Sort toggle
  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  }

  function sortIndicator(field: string) {
    if (sortField !== field) return null;
    return <span className={styles.sortArrow}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
  }

  // Filter reset
  function clearFilters() {
    setSearch(''); setSearchInput(''); setStatusFilter('');
    setCategoryFilter(''); setStockFilter(''); setIssuesFilter('');
    setSortField('updatedAt'); setSortDir('desc'); setPage(1);
  }

  const hasActiveFilters = search || statusFilter || categoryFilter || stockFilter || issuesFilter;

  // SEO bulk — two-step confirm (first click arms, second click fires)
  async function handleBulkSEO() {
    if (!seoConfirming) {
      setSeoConfirming(true);
      setTimeout(() => setSeoConfirming(false), 5000);
      return;
    }
    setSeoConfirming(false);
    setSeoGenerating(true); setSeoResult('');
    try {
      const res = await fetch(`${API}/api/admin/products/bulk-generate-seo`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setSeoResult(data.message || 'Done');
    } catch { setSeoResult('Failed'); }
    finally { setSeoGenerating(false); }
  }

  // Single delete
  async function handleDelete(product: Product, confirmation: string) {
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API}/api/admin/products/${product._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmation }),
      });
      const data = await res.json();
      if (data.deleted) {
        setProducts(prev => prev.filter(p => p._id !== product._id));
      } else if (data.archived) {
        setProducts(prev => prev.map(p => p._id === product._id ? { ...p, status: 'archived' } : p));
        showAction(data.message);
      }
    } catch { showAction('Delete failed'); }
  }

  // Bulk delete confirmation modal
  const [bulkDeleteTyped, setBulkDeleteTyped] = useState('');

  async function executeBulkDelete() {
    const ids = [...selectedIds];
    setBulkDeletePending(false);
    setBulkLoading(true);
    setBulkMessage(`Deleting ${ids.length} products…`);
    try {
      const res = await fetch(`${API}/api/admin/products/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productIds: ids, confirmation: 'DELETE' }),
      });
      const data = await res.json();
      setBulkMessage(data.message || 'Done');
      setSelectedIds(new Set());
      load();
    } catch { setBulkMessage('Delete failed'); }
    finally { setBulkLoading(false); setTimeout(() => setBulkMessage(''), 3000); }
  }

  // Bulk actions
  async function handleBulkAction(action: string, payload?: unknown) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (action === 'bulk-delete') {
      setBulkDeleteTyped('');
      setBulkDeletePending(true);
      return;
    }

    if (action === 'export') {
      try {
        const res = await fetch(`${API}/api/admin/products/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productIds: ids }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `products-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
      } catch { showAction('Export failed'); }
      return;
    }

    const endpoints: Record<string, string> = {
      publish: 'bulk-publish',
      archive: 'bulk-archive',
      category: 'bulk-category',
      discount: 'bulk-discount',
    };
    const endpoint = endpoints[action];
    if (!endpoint) return;

    setBulkLoading(true);
    const label = action === 'publish' ? 'Publishing' : action === 'archive' ? 'Archiving' : action === 'category' ? 'Updating' : 'Applying discount to';
    setBulkMessage(`${label} ${ids.length} products…`);

    try {
      const body: Record<string, unknown> = { productIds: ids };
      if (action === 'category') body.category = payload;
      if (action === 'discount') body.discountPercent = payload;

      const res = await fetch(`${API}/api/admin/products/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setBulkMessage(data.error || 'Failed'); return; }
      setBulkMessage(`Done — ${data.updated ?? ids.length} updated`);
      setSelectedIds(new Set());
      load();
    } catch { setBulkMessage('Request failed'); }
    finally { setBulkLoading(false); setTimeout(() => setBulkMessage(''), 3000); }
  }

  const allSelected = products.length > 0 && products.every(p => selectedIds.has(p._id));
  const someSelected = products.some(p => selectedIds.has(p._id));

  return (
    <AdminLayout active="products">
      {/* Bulk action bar */}
      <BulkBar
        count={selectedIds.size}
        onAction={handleBulkAction}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkLoading}
        message={bulkMessage}
        categories={categories}
      />

      {/* Bulk delete confirmation modal */}
      {bulkDeletePending && (
        <div className={styles.modalOverlay} onClick={() => setBulkDeletePending(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete {selectedIds.size} products?</h3>
            <p className={styles.modalBody}>Products with order history will be archived instead.</p>
            <p className={styles.modalNote}>⚠ This cannot be undone.</p>
            <label className={styles.modalLabel}>Type DELETE to confirm:</label>
            <input
              className={styles.modalInput}
              value={bulkDeleteTyped}
              onChange={e => setBulkDeleteTyped(e.target.value)}
              autoFocus placeholder="DELETE"
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setBulkDeletePending(false)}>Cancel</button>
              <button className={styles.modalConfirm} disabled={bulkDeleteTyped !== 'DELETE'} onClick={executeBulkDelete}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single delete modal */}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onConfirm={(c) => handleDelete(deleteTarget, c)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <h2>Products <span className={styles.totalCount}>{total > 0 ? `(${total})` : ''}</span></h2>
        <div className={styles.headerActions}>
          <button className={styles.bulkSeoBtn} onClick={handleBulkSEO} disabled={seoGenerating}>
            {seoGenerating ? '✨ Generating…' : seoConfirming ? 'Confirm — generate SEO?' : '✨ Generate missing SEO'}
          </button>
          {seoResult && <span className={styles.bulkSeoResult}>{seoResult}</span>}
          <a href="/admin/products/new" className={styles.addBtn}>+ Add product</a>
        </div>
      </div>

      {actionMessage && <div className={styles.actionMsg}>{actionMessage}</div>}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <form className={styles.searchRow} onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
          <input
            className={styles.searchInput}
            placeholder="Search products…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>

        <div className={styles.filterSelects}>
          <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="sold_out">Sold out</option>
            <option value="archived">Archived</option>
          </select>

          <select className={styles.filterSelect} value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>

          <select className={styles.filterSelect} value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(1); }}>
            <option value="">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock (&lt; 5)</option>
            <option value="out">Out of stock</option>
          </select>

          <select className={styles.filterSelect} value={issuesFilter} onChange={e => { setIssuesFilter(e.target.value); setPage(1); }}>
            <option value="">All products</option>
            <option value="no-images">Missing images</option>
            <option value="no-variants">Missing variants</option>
            <option value="no-seo">Missing SEO</option>
            <option value="no-description">Missing description</option>
          </select>

          {hasActiveFilters && (
            <button className={styles.clearBtn} onClick={clearFilters}>Clear</button>
          )}
        </div>
      </div>

      {/* Table + mobile cards */}
      {loading ? (
        <p className={styles.loadingText}>Loading…</p>
      ) : loadError ? (
        <AdminErrorBanner error={loadError} onRetry={load} />
      ) : products.length === 0 ? (
        <p className={styles.emptyText}>No products found.</p>
      ) : (
        <>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 64 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleSelectAll}
                    title="Select all on this page"
                  />
                </th>
                <th></th>
                <th>
                  <button className={styles.sortBtn} onClick={() => handleSort('name')}>
                    Name{sortIndicator('name')}
                  </button>
                </th>
                <th>Status</th>
                <th>
                  <button className={styles.sortBtn} onClick={() => handleSort('price')}>
                    Price{sortIndicator('price')}
                  </button>
                </th>
                <th>
                  <button className={styles.sortBtn} onClick={() => handleSort('totalStock')}>
                    Stock{sortIndicator('totalStock')}
                  </button>
                </th>
                <th>
                  <button className={styles.sortBtn} onClick={() => handleSort('updatedAt')}>
                    Updated{sortIndicator('updatedAt')}
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const isSelected = selectedIds.has(product._id);
                const imgUrl = thumb(product);
                return (
                  <tr key={product._id} className={isSelected ? styles.selectedRow : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggleSelect(product._id)}
                      />
                    </td>
                    <td>
                      {imgUrl ? (
                        <img src={imgUrl} alt={product.name} className={styles.thumbnail} />
                      ) : (
                        <div className={`${styles.noImage} ${styles.noImageWarn}`} title="No images">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td>
                      <a href={`/admin/products/${product._id}`} className={styles.productName}>
                        {product.name}
                        {product.status !== 'draft' && !product.costing?.totalUnitCost && (
                          <span title="No costing data — Finance tab will show unknown COGS" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#555', marginLeft: 6, verticalAlign: 'middle' }} />
                        )}
                      </a>
                      <InlineCategoryEdit product={product} categories={categories} onUpdate={updateProduct} />
                      <IssuePills product={product} />
                    </td>
                    <td>
                      <InlineStatusEdit product={product} onUpdate={updateProduct} />
                    </td>
                    <td>
                      <InlinePriceEdit product={product} onUpdate={updateProduct} />
                    </td>
                    <td>
                      <InlineStockEdit product={product} onUpdate={updateProduct} />
                    </td>
                    <td className={styles.updatedAt}>{fmtDate(product.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <a href={`/admin/products/${product._id}`} className={styles.editBtn}>Edit</a>
                        <button className={styles.deleteBtn} onClick={() => setDeleteTarget(product)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className={styles.productCardList}>
          {products.map(product => {
            const imgUrl = thumb(product);
            return (
              <div key={product._id} className={styles.productCard}>
                {imgUrl ? (
                  <img src={imgUrl} alt={product.name} className={styles.productCardImg} />
                ) : (
                  <div className={`${styles.productCardNoImg} ${styles.noImageWarn}`} title="No images">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                )}
                <div className={styles.productCardBody}>
                  <div className={styles.productCardTop}>
                    <a href={`/admin/products/${product._id}`} className={styles.productCardName}>
                      {product.name}
                    </a>
                    <span className={`${styles.statusBadge} ${STATUS_CLASS[product.status] ?? ''}`}>
                      {STATUS_LABEL[product.status] ?? product.status}
                    </span>
                  </div>
                  {product.category && (
                    <div className={styles.productCardCat}>
                      {categories.find(c => c.slug === product.category)?.label || `⚠ ${product.category} (missing)`}
                    </div>
                  )}
                  <div className={styles.productCardMeta}>
                    €{product.price.toFixed(2)} · <StockBadge product={product} />
                  </div>
                  <IssuePills product={product} />
                  <div className={styles.productCardActions}>
                    <a href={`/admin/products/${product._id}`} className={styles.editBtn}>Edit</a>
                    <button className={styles.deleteBtn} onClick={() => setDeleteTarget(product)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
          </span>
          <div className={styles.pageControls}>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Previous
            </button>
            <span className={styles.pageCurrent}>Page {page} of {pages}</span>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>
              Next →
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
