'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AiPhotoshoot from '@/components/AiPhotoshoot';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'draft' | 'active' | 'sold_out' | 'archived';
type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

type Variant = {
  _id?: string;
  sku: string;
  colour: string;
  size: string;
  stockLevel: number;
  lowStockThreshold: number;
};

type ProductImage = {
  _id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
  associatedColour?: string;
};

type Form = {
  name: string;
  status: Status;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  category: string;
  description: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string;
  altTextTemplate: string;
  materialComposition: string;
  careInstructions: string;
  origin: string;
  certifications: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const CATEGORIES = [
  { slug: 'robes',         label: 'Robes' },
  { slug: 'pyjamas',       label: 'Pyjama Sets' },
  { slug: 'sleep-dresses', label: 'Sleep Dresses' },
  { slug: 'lingerie',      label: 'Lingerie' },
  { slug: 'shorts',        label: 'Lounge Shorts' },
  { slug: 'shirts',        label: 'Lounge Shirts' },
  { slug: 'pillowcases',   label: 'Pillowcases' },
  { slug: 'eye-masks',     label: 'Eye Masks' },
  { slug: 'scarves',       label: 'Scarves' },
];

const EMPTY_FORM: Form = {
  name: '', status: 'draft', price: '', compareAtPrice: '', costPrice: '',
  category: 'robes', description: '', tags: '',
  metaTitle: '', metaDescription: '', slug: '', keywords: '', altTextTemplate: '',
  materialComposition: '', careInstructions: '', origin: 'Made in Dublin', certifications: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function genSku(name: string, colour: string, size: string) {
  const parts = ['SLK'];
  if (name) parts.push(name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase());
  if (colour) parts.push(colour.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase());
  if (size) parts.push(size.replace(/\s/g, '').toUpperCase());
  return parts.join('-');
}

function timeAgo(date: Date) {
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function CharCounter({ value, max, warnAt }: { value: string; max: number; warnAt?: number }) {
  const len = value.length;
  const warn = warnAt ?? Math.floor(max * 0.85);
  const cls = len > max ? styles.counterOver : len > warn ? styles.counterWarn : styles.counterOk;
  return <span className={`${styles.charCounter} ${cls}`}>{len}/{max}</span>;
}

function calcSeoScore(form: Form, images: ProductImage[], variants: Variant[]) {
  let score = 0;
  const missing: string[] = [];

  if (form.metaTitle) score += 10; else missing.push('Add meta title');
  const tl = form.metaTitle.length;
  if (form.metaTitle && tl >= 50 && tl <= 60) score += 10;
  else if (form.metaTitle) missing.push('Meta title: aim for 50–60 chars');

  if (form.metaDescription) score += 10; else missing.push('Add meta description');
  const dl = form.metaDescription.length;
  if (form.metaDescription && dl >= 140 && dl <= 165) score += 10;
  else if (form.metaDescription) missing.push('Meta description: aim for 140–165 chars');

  if (form.slug) score += 10; else missing.push('URL slug missing');
  if (images.length >= 3) score += 10; else missing.push(`Add ${3 - images.length} more image(s)`);
  if (images.length > 0 && images.every(i => i.alt)) score += 10;
  else if (images.length > 0) missing.push('Add alt text to all images');

  if (form.description && form.description.length > 150) score += 10;
  else missing.push('Description should be 150+ chars');

  if (form.materialComposition) score += 5; else missing.push('Add material composition');
  if (variants.some(v => v.stockLevel > 0)) score += 5; else missing.push('Add stock to at least 1 variant');
  if (form.keywords.split(',').filter(Boolean).length >= 3) score += 10;
  else missing.push('Add 3+ keywords');

  return { score, missing };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [seoGenerating, setSeoGenerating]   = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [seoToast, setSeoToast]             = useState('');
  // Generate wizard
  const [showWizard, setShowWizard] = useState(false);
  const [genColours, setGenColours] = useState('');
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genCustomSize, setGenCustomSize] = useState('');

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const altTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load product
  useEffect(() => {
    fetch(`${API}/api/admin/products/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p) return;
        setForm({
          name: p.name ?? '',
          status: p.status ?? 'draft',
          price: p.price?.toString() ?? '',
          compareAtPrice: p.compareAtPrice?.toString() ?? '',
          costPrice: p.costPrice?.toString() ?? '',
          category: p.category ?? 'shorts',
          description: p.description ?? '',
          tags: (p.tags ?? []).join(', '),
          metaTitle: p.metaTitle ?? '',
          metaDescription: p.metaDescription ?? '',
          slug: p.slug ?? '',
          keywords: (p.keywords ?? []).join(', '),
          altTextTemplate: p.altTextTemplate ?? '',
          materialComposition: p.materialComposition ?? '',
          careInstructions: p.careInstructions ?? '',
          origin: p.origin ?? 'Made in Dublin',
          certifications: (p.certifications ?? []).join(', '),
        });
        const sorted = (p.images ?? []).slice().sort((a: ProductImage, b: ProductImage) => a.order - b.order);
        setImages(sorted);
        setVariants(p.variants ?? []);
        setLastSaved(new Date(p.updatedAt));
        setSaveState('saved');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const markDirty = useCallback(() => {
    setSaveState('unsaved');
    setSaveError('');
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doSave, 30_000);
  }, []); // eslint-disable-line

  // Auto-clear SEO toast after 4s
  useEffect(() => {
    if (!seoToast) return;
    const t = setTimeout(() => setSeoToast(''), 4000);
    return () => clearTimeout(t);
  }, [seoToast]);

  function setField(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    markDirty();
    if (aiFilledFields.has(field)) {
      setAiFilledFields(prev => { const n = new Set(prev); n.delete(field); return n; });
    }
  }

  async function generateSEO() {
    setSeoGenerating(true);
    try {
      const res = await fetch(`${API}/api/admin/products/${id}/generate-seo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          materialComposition: form.materialComposition,
          colours: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          price: form.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);
      const { seo } = data;
      const filled = new Set<string>();
      if (seo.metaTitle)       { setForm(f => ({ ...f, metaTitle: seo.metaTitle }));             filled.add('metaTitle'); }
      if (seo.metaDescription) { setForm(f => ({ ...f, metaDescription: seo.metaDescription })); filled.add('metaDescription'); }
      if (seo.slug)            { setForm(f => ({ ...f, slug: seo.slug }));                        filled.add('slug'); }
      if (seo.keywords?.length){ setForm(f => ({ ...f, keywords: seo.keywords.join(', ') }));    filled.add('keywords'); }
      if (seo.altTextTemplate) { setForm(f => ({ ...f, altTextTemplate: seo.altTextTemplate })); filled.add('altTextTemplate'); }
      setAiFilledFields(filled);
      setSeoToast('SEO generated — review and save');
      markDirty();
    } catch (err) {
      setSeoToast(`SEO failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSeoGenerating(false);
    }
  }

  const doSave = useCallback(async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      const body = {
        ...form,
        price: Number(form.price) || 0,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
        certifications: form.certifications.split(',').map(c => c.trim()).filter(Boolean),
        altTextTemplate: form.altTextTemplate,
        variants,
      };
      const res = await fetch(`${API}/api/admin/products/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      const updated = await res.json();
      if (updated.slug) setForm(f => ({ ...f, slug: updated.slug }));
      setSaveState('saved');
      setLastSaved(new Date());
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }, [form, variants, id]);

  // Image handlers
  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('images', f));
    try {
      const res = await fetch(`${API}/api/admin/products/${id}/images`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (res.ok) {
        const updated = await res.json();
        setImages(updated.slice().sort((a: ProductImage, b: ProductImage) => a.order - b.order));
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm('Delete this image?')) return;
    const res = await fetch(`${API}/api/admin/products/${id}/images/${imageId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) {
      const updated = await res.json();
      setImages(updated.slice().sort((a: ProductImage, b: ProductImage) => a.order - b.order));
    }
  }

  async function handleSetPrimary(imageId: string) {
    const res = await fetch(`${API}/api/admin/products/${id}/images/${imageId}/primary`, {
      method: 'PUT', credentials: 'include',
    });
    if (res.ok) {
      const updated = await res.json();
      setImages(updated.slice().sort((a: ProductImage, b: ProductImage) => a.order - b.order));
    }
  }

  async function handleMoveImage(imageId: string, dir: 'up' | 'down') {
    const idx = images.findIndex(img => img._id === imageId);
    if (idx === -1) return;
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === images.length - 1) return;
    const next = [...images];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setImages(next);
    await fetch(`${API}/api/admin/products/${id}/images/reorder`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map(img => img._id) }),
    });
  }

  function handleAltChange(imageId: string, alt: string) {
    setImages(prev => prev.map(img => img._id === imageId ? { ...img, alt } : img));
    clearTimeout(altTimers.current[imageId]);
    altTimers.current[imageId] = setTimeout(async () => {
      await fetch(`${API}/api/admin/products/${id}/images/${imageId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt }),
      });
    }, 1000);
  }

  // Variant handlers
  function updateVariantField(idx: number, field: keyof Variant, value: string | number) {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
    markDirty();
  }

  function removeVariant(idx: number) {
    if (!confirm('Remove this variant?')) return;
    setVariants(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  }

  function generateVariants() {
    const colours = genColours.split(',').map(c => c.trim()).filter(Boolean);
    const sizes = [
      ...genSizes,
      ...genCustomSize.split(',').map(s => s.trim()).filter(Boolean),
    ];
    const pairs: [string, string][] = [];
    if (colours.length > 0 && sizes.length > 0) {
      for (const c of colours) for (const s of sizes) pairs.push([c, s]);
    } else if (colours.length > 0) {
      for (const c of colours) pairs.push([c, '']);
    } else {
      for (const s of sizes) pairs.push(['', s]);
    }
    const newVariants: Variant[] = [];
    for (const [colour, size] of pairs) {
      const exists = variants.some(v => v.colour === colour && v.size === size);
      if (!exists) {
        newVariants.push({ sku: genSku(form.name, colour, size), colour, size, stockLevel: 0, lowStockThreshold: 3 });
      }
    }
    setVariants(prev => [...prev, ...newVariants]);
    markDirty();
    setShowWizard(false);
    setGenColours(''); setGenSizes([]); setGenCustomSize('');
  }

  // Derived values
  const totalStock = variants.reduce((s, v) => s + (v.stockLevel || 0), 0);
  const price = Number(form.price) || 0;
  const costPrice = Number(form.costPrice) || 0;
  const margin = costPrice > 0 && price > 0 ? Math.round(((price - costPrice) / price) * 100) : null;
  const { score: seoScore, missing: seoMissing } = calcSeoScore(form, images, variants);
  const previewSlug = form.slug || slugify(form.name);
  const previewTitle = form.metaTitle || (form.name ? `${form.name} — SILKILINEN` : '');
  const previewDesc = form.metaDescription || form.description.slice(0, 155);

  // Wizard combo count
  const wizardColours = genColours.split(',').map(c => c.trim()).filter(Boolean);
  const wizardSizes = [...genSizes, ...genCustomSize.split(',').map(s => s.trim()).filter(Boolean)];
  const wizardCount = wizardColours.length > 0 && wizardSizes.length > 0
    ? wizardColours.length * wizardSizes.length
    : wizardColours.length + wizardSizes.length;

  if (loading) {
    return <AdminLayout active="products"><p className={styles.loading}>Loading…</p></AdminLayout>;
  }

  return (
    <AdminLayout active="products">

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <div className={styles.stickyBar}>
        <div className={styles.stickyLeft}>
          <a href="/admin/products" className={styles.backLink}>← Products</a>
          <span className={styles.pageTitle}>{form.name || 'Untitled product'}</span>
        </div>
        <div className={styles.stickyRight}>
          <select
            className={`${styles.statusSelect} ${styles[`s_${form.status}`]}`}
            value={form.status}
            onChange={e => setField('status', e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="sold_out">Sold out</option>
            <option value="archived">Archived</option>
          </select>

          <span className={styles.saveIndicator}>
            {saveState === 'saving' && <span className={styles.stateSaving}>Saving…</span>}
            {saveState === 'saved' && lastSaved && (
              <span className={styles.stateSaved}>✓ {timeAgo(lastSaved)}</span>
            )}
            {saveState === 'unsaved' && <span className={styles.stateUnsaved}>● Unsaved</span>}
            {saveState === 'error' && (
              <span className={styles.stateError} title={saveError}>✕ Save failed</span>
            )}
          </span>

          <a
            href={`/product/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.previewBtn}
          >Preview ↗</a>

          <button
            className={styles.dupBtn}
            onClick={async () => {
              const res = await fetch(`${API}/api/admin/products/${id}/duplicate`, {
                method: 'POST', credentials: 'include',
              });
              if (res.ok) {
                const copy = await res.json();
                window.location.href = `/admin/products/${copy._id}`;
              }
            }}
          >Duplicate</button>

          <button
            className={styles.saveBtn}
            onClick={doSave}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Two-column grid ──────────────────────────────────────────────── */}
      <div className={styles.editGrid}>

        {/* LEFT COLUMN */}
        <div className={styles.leftCol}>

          {/* Basic Info */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Basic information</h3>
            <div className={styles.fg}>
              <label className={styles.label}>
                Product name <CharCounter value={form.name} max={80} />
              </label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                onBlur={() => { if (!form.slug && form.name) setField('slug', slugify(form.name)); }}
                placeholder="e.g. Bastet Silk Shorts"
              />
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>
                Description <CharCounter value={form.description} max={2000} />
              </label>
              <textarea
                className={`${styles.input} ${styles.textareaLg}`}
                rows={7}
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Describe the product…"
              />
            </div>
            <div className={styles.frow}>
              <div className={styles.fg}>
                <label className={styles.label}>Category</label>
                <select className={styles.input} value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fg}>
                <label className={styles.label}>Tags (comma separated)</label>
                <input className={styles.input} value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="silk, lingerie, handmade" />
              </div>
            </div>
          </section>

          {/* Images */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Images</h3>
              <span className={styles.cardMeta}>{images.length} image{images.length !== 1 ? 's' : ''}</span>
            </div>
            <label className={`${styles.uploadArea} ${uploading ? styles.uploadAreaBusy : ''}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                className={styles.fileInputHidden}
                onChange={e => handleImageUpload(e.target.files)}
                disabled={uploading}
              />
              {uploading ? (
                <span className={styles.uploadText}>Uploading…</span>
              ) : (
                <>
                  <span className={styles.uploadPlus}>+</span>
                  <span className={styles.uploadText}>Click to upload images</span>
                  <span className={styles.uploadHint}>JPEG · PNG · WebP · max 10 MB · 4:5 portrait ideal</span>
                </>
              )}
            </label>

            {images.length > 0 && (
              <div className={styles.imageGrid}>
                {images.map((img, idx) => (
                  <div key={img._id} className={styles.imgCard}>
                    <div className={styles.imgThumbWrap}>
                      <img src={img.url} alt={img.alt || ''} className={styles.imgThumb} />
                      {img.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                    </div>
                    <input
                      className={styles.altInput}
                      value={img.alt}
                      onChange={e => handleAltChange(img._id, e.target.value)}
                      placeholder="Alt text (required for SEO)…"
                    />
                    <div className={styles.imgActions}>
                      <button className={styles.imgBtn} onClick={() => handleMoveImage(img._id, 'up')} disabled={idx === 0} title="Move up">▲</button>
                      <button className={styles.imgBtn} onClick={() => handleMoveImage(img._id, 'down')} disabled={idx === images.length - 1} title="Move down">▼</button>
                      {!img.isPrimary && (
                        <button className={styles.imgBtn} onClick={() => handleSetPrimary(img._id)} title="Set as primary">★</button>
                      )}
                      <button className={`${styles.imgBtn} ${styles.imgBtnDel}`} onClick={() => handleDeleteImage(img._id)} title="Delete">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Variants */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Variants & inventory</h3>
              <span className={styles.cardMeta}>
                {totalStock} unit{totalStock !== 1 ? 's' : ''} · {variants.length} variant{variants.length !== 1 ? 's' : ''}
              </span>
            </div>

            {variants.length > 0 && (
              <div className={styles.varTableWrap}>
                <table className={styles.varTable}>
                  <thead>
                    <tr>
                      <th>Colour</th>
                      <th>Size</th>
                      <th>SKU</th>
                      <th>Stock</th>
                      <th>Alert</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => {
                      const st = v.stockLevel === 0 ? 'out' : v.stockLevel <= v.lowStockThreshold ? 'low' : 'in';
                      return (
                        <tr key={v._id || idx}>
                          <td><input className={styles.varInput} value={v.colour} onChange={e => updateVariantField(idx, 'colour', e.target.value)} placeholder="—" /></td>
                          <td><input className={styles.varInput} value={v.size} onChange={e => updateVariantField(idx, 'size', e.target.value)} placeholder="—" /></td>
                          <td><input className={styles.varInput} value={v.sku} onChange={e => updateVariantField(idx, 'sku', e.target.value)} /></td>
                          <td>
                            <input
                              className={`${styles.varInput} ${styles.varStock}`}
                              type="number" min="0"
                              value={v.stockLevel}
                              onChange={e => updateVariantField(idx, 'stockLevel', Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              className={`${styles.varInput} ${styles.varThresh}`}
                              type="number" min="0"
                              value={v.lowStockThreshold}
                              onChange={e => updateVariantField(idx, 'lowStockThreshold', Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <span className={`${styles.stockBadge} ${styles[`sk_${st}`]}`}>
                              {st === 'in' ? '✓ In stock' : st === 'low' ? '⚠ Low' : '✕ Out'}
                            </span>
                          </td>
                          <td>
                            <button className={styles.varDel} onClick={() => removeVariant(idx)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {variants.length === 0 && (
              <p className={styles.varEmpty}>No variants yet. Use "Generate variants" to create size/colour combinations, or add one manually.</p>
            )}

            <div className={styles.wizardBar}>
              <button className={styles.generateBtn} onClick={() => setShowWizard(w => !w)}>
                {showWizard ? '− Hide' : '+ Generate variants'}
              </button>
            </div>

            {showWizard && (
              <div className={styles.wizard}>
                <div className={styles.fg}>
                  <label className={styles.label}>Colours (comma separated)</label>
                  <input className={styles.input} value={genColours} onChange={e => setGenColours(e.target.value)} placeholder="Ivory, Navy Blue, Emerald Green" />
                </div>
                <div className={styles.fg}>
                  <label className={styles.label}>Standard sizes</label>
                  <div className={styles.sizeChecks}>
                    {STANDARD_SIZES.map(s => (
                      <label key={s} className={styles.sizeCheck}>
                        <input
                          type="checkbox"
                          checked={genSizes.includes(s)}
                          onChange={e => setGenSizes(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                  <input className={`${styles.input} ${styles.mt8}`} value={genCustomSize} onChange={e => setGenCustomSize(e.target.value)} placeholder="Custom sizes (comma separated)…" />
                </div>
                <div className={styles.wizardFooter}>
                  <span className={styles.wizardCount}>
                    Will add {wizardCount} new combination{wizardCount !== 1 ? 's' : ''}
                  </span>
                  <button className={styles.applyBtn} onClick={generateVariants} disabled={wizardCount === 0}>
                    Apply
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Material & Care */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Material & care</h3>
            <div className={styles.fg}>
              <label className={styles.label}>Material composition</label>
              <input className={styles.input} value={form.materialComposition} onChange={e => setField('materialComposition', e.target.value)} placeholder="100% Mulberry Silk 19mm Momme" />
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>Care instructions</label>
              <textarea className={`${styles.input} ${styles.textareaSm}`} rows={3} value={form.careInstructions} onChange={e => setField('careInstructions', e.target.value)} placeholder="Hand wash cold. Lay flat to dry. Do not bleach. Iron on low heat." />
            </div>
            <div className={styles.frow}>
              <div className={styles.fg}>
                <label className={styles.label}>Country of origin</label>
                <input className={styles.input} value={form.origin} onChange={e => setField('origin', e.target.value)} placeholder="Made in Dublin" />
              </div>
              <div className={styles.fg}>
                <label className={styles.label}>Certifications (comma separated)</label>
                <input className={styles.input} value={form.certifications} onChange={e => setField('certifications', e.target.value)} placeholder="OEKO-TEX Standard 100, GOTS" />
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightCol}>

          {/* Pricing */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Pricing</h3>
            <div className={styles.fg}>
              <label className={styles.label}>Price (€) *</label>
              <input className={styles.input} type="number" step="0.01" min="0" value={form.price} onChange={e => setField('price', e.target.value)} />
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>Compare-at price (€)</label>
              <input className={styles.input} type="number" step="0.01" min="0" value={form.compareAtPrice} onChange={e => setField('compareAtPrice', e.target.value)} />
              {form.compareAtPrice && Number(form.compareAtPrice) > price && (
                <p className={styles.salePreview}>
                  Sale: <s>€{Number(form.compareAtPrice).toFixed(2)}</s>{' '}
                  <strong>€{price.toFixed(2)}</strong>{' '}
                  · saves €{(Number(form.compareAtPrice) - price).toFixed(2)}
                </p>
              )}
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>Cost price (€) — admin only</label>
              <input className={styles.input} type="number" step="0.01" min="0" value={form.costPrice} onChange={e => setField('costPrice', e.target.value)} />
            </div>
            {margin !== null && (
              <div className={styles.marginPill}>
                {margin}% margin · €{(price - costPrice).toFixed(2)} profit per unit
              </div>
            )}
          </section>

          {/* SEO */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>SEO</h3>

            {/* Score bar */}
            <div className={styles.scoreRow}>
              <div className={styles.scoreBar}>
                <div
                  className={`${styles.scoreFill} ${seoScore >= 80 ? styles.scoreGreen : seoScore >= 50 ? styles.scoreOrange : styles.scoreRed}`}
                  style={{ width: `${seoScore}%` }}
                />
              </div>
              <span className={styles.scoreNum}>{seoScore}/100</span>
            </div>
            {seoMissing.length > 0 && (
              <ul className={styles.scoreMissing}>
                {seoMissing.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}
                {seoMissing.length > 5 && <li>+{seoMissing.length - 5} more…</li>}
              </ul>
            )}

            {/* Generate SEO button */}
            <button
              className={styles.seoGenBtn}
              onClick={generateSEO}
              disabled={seoGenerating || !form.name}
            >
              {seoGenerating ? '✨ Generating SEO…' : '✨ Generate SEO with AI — €0.001'}
            </button>

            {/* Toast */}
            {seoToast && (
              <div className={`${styles.seoToast} ${seoToast.startsWith('SEO failed') ? styles.seoToastError : ''}`}>
                {seoToast}
              </div>
            )}

            <div className={styles.fg}>
              <label className={styles.label}>URL slug</label>
              <div className={`${styles.slugRow} ${aiFilledFields.has('slug') ? styles.aiFilledBorder : ''}`}>
                <span className={styles.slugBase}>silkilinen.com/product/</span>
                <input
                  className={`${styles.input} ${styles.slugInput}`}
                  value={form.slug}
                  onChange={e => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="product-name"
                />
              </div>
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>
                Meta title <CharCounter value={form.metaTitle} max={70} warnAt={60} />
              </label>
              <input
                className={`${styles.input} ${aiFilledFields.has('metaTitle') ? styles.aiFilledInput : ''}`}
                value={form.metaTitle}
                maxLength={70}
                onChange={e => setField('metaTitle', e.target.value)}
                placeholder={`${form.name || 'Product name'} — SILKILINEN`}
              />
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>
                Meta description <CharCounter value={form.metaDescription} max={165} warnAt={140} />
              </label>
              <textarea
                className={`${styles.input} ${styles.textareaSm} ${aiFilledFields.has('metaDescription') ? styles.aiFilledInput : ''}`}
                rows={3}
                value={form.metaDescription}
                maxLength={165}
                onChange={e => setField('metaDescription', e.target.value)}
                placeholder="Brief description for search results…"
              />
            </div>
            <div className={styles.fg}>
              <label className={styles.label}>Keywords (comma separated)</label>
              <input
                className={`${styles.input} ${aiFilledFields.has('keywords') ? styles.aiFilledInput : ''}`}
                value={form.keywords}
                onChange={e => setField('keywords', e.target.value)}
                placeholder="silk shorts, luxury lingerie, handmade Dublin"
              />
            </div>
            {form.altTextTemplate && (
              <div className={styles.fg}>
                <label className={styles.label}>Image alt text template</label>
                <input
                  className={`${styles.input} ${aiFilledFields.has('altTextTemplate') ? styles.aiFilledInput : ''}`}
                  value={form.altTextTemplate}
                  onChange={e => setField('altTextTemplate', e.target.value)}
                  placeholder="Product name — {position} view, handmade silk by SILKILINEN Dublin"
                />
              </div>
            )}

            {/* Google preview */}
            <div className={styles.gpCard}>
              <p className={styles.gpUrl}>silkilinen.com › product › {previewSlug || '…'}</p>
              <p className={styles.gpTitle}>{previewTitle || 'Page title not set'}</p>
              <p className={styles.gpDesc}>{previewDesc || 'Meta description not set.'}</p>
            </div>
          </section>

          {/* AI Photoshoot */}
          <AiPhotoshoot
            productId={id}
            productCategory={form.category}
            onPhotoApproved={async (url) => {
              const res = await fetch(`${API}/api/admin/products/${id}/images/url`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
              });
              if (res.ok) {
                const updated = await res.json();
                setImages(updated.slice().sort((a: ProductImage, b: ProductImage) => a.order - b.order));
              }
            }}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
