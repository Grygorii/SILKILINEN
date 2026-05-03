'use client';

import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type ContentItem = {
  _id: string;
  key: string;
  type: 'image' | 'text' | 'richtext' | 'url';
  value: string;
  altText: string;
  caption: string;
  section: string;
  label: string;
  order: number;
};

type EditState = {
  item: ContentItem;
  value: string;
  altText: string;
  caption: string;
  preview: string | null;
  file: File | null;
};

const TABS = [
  { id: 'banner',     label: 'Banner' },
  { id: 'homepage',   label: 'Homepage' },
  { id: 'categories', label: 'Categories' },
  { id: 'about',      label: 'About' },
  { id: 'instagram',  label: 'Instagram' },
  { id: 'library',    label: 'Image Library' },
];

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('banner');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/content/all-admin`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function openEdit(item: ContentItem) {
    setEdit({ item, value: item.value, altText: item.altText, caption: item.caption, preview: null, file: null });
    setError('');
  }

  function closeEdit() {
    setEdit(null);
    setError('');
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !edit) return;
    setEdit(prev => prev ? { ...prev, file } : null);
    const reader = new FileReader();
    reader.onload = ev => setEdit(prev => prev ? { ...prev, preview: ev.target?.result as string } : null);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!edit) return;
    setSaving(true);
    setError('');

    try {
      let finalUrl = edit.value;

      if (edit.file) {
        const formData = new FormData();
        formData.append('image', edit.file);
        const uploadRes = await fetch(
          `${API}/api/content/upload?section=${edit.item.section}`,
          { method: 'POST', credentials: 'include', body: formData }
        );
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error || 'Upload failed');
        const uploaded = await uploadRes.json();
        finalUrl = uploaded.url;
      }

      const res = await fetch(`${API}/api/content/${edit.item.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: finalUrl, altText: edit.altText, caption: edit.caption }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      const updated = await res.json();

      setItems(prev => prev.map(i => i.key === updated.key ? { ...i, ...updated } : i));
      setSavedKey(updated.key);
      setTimeout(() => setSavedKey(''), 2500);
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function reuseImage(url: string) {
    if (!edit) return;
    setEdit(prev => prev ? { ...prev, value: url, preview: url, file: null } : null);
  }

  const tabItems = tab === 'library'
    ? items.filter(i => i.type === 'image' && i.value)
    : items.filter(i => i.section === tab);

  const libraryImages = items.filter(i => i.type === 'image' && i.value);

  return (
    <AdminLayout active="content">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Site Content</h1>
          <p className={styles.sub}>Changes go live within 60 seconds</p>
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <>
            {tab === 'library' ? (
              <div className={styles.libraryGrid}>
                {libraryImages.length === 0 && (
                  <p className={styles.empty}>No images uploaded yet</p>
                )}
                {libraryImages.map(img => (
                  <div key={img.key} className={styles.libraryCard}>
                    <div className={styles.libraryThumb}>
                      <img src={img.value} alt={img.altText || img.label} />
                    </div>
                    <p className={styles.libraryLabel}>{img.label}</p>
                    <p className={styles.librarySection}>{img.section}</p>
                    {edit && (
                      <button className={styles.reuseBtn} onClick={() => reuseImage(img.value)}>
                        Use this image
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.grid}>
                {tabItems.length === 0 && (
                  <p className={styles.empty}>No content keys for this section yet. Run the seed script.</p>
                )}
                {tabItems.map(item => (
                  <div key={item.key} className={styles.card}>
                    <div className={styles.cardPreview}>
                      {item.type === 'image' ? (
                        item.value
                          ? <img src={item.value} alt={item.altText || item.label} className={styles.thumb} />
                          : <div className={styles.thumbEmpty}>No image</div>
                      ) : (
                        <p className={styles.textPreview}>
                          {item.value
                            ? item.value.replace(/<[^>]+>/g, '').slice(0, 120) + (item.value.length > 120 ? '…' : '')
                            : <em>Empty</em>
                          }
                        </p>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      <p className={styles.cardLabel}>{item.label}</p>
                      <span className={styles.cardType}>{item.type}</span>
                    </div>
                    <button className={styles.editBtn} onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    {savedKey === item.key && <span className={styles.savedBadge}>✓ Saved</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {edit && (
        <div className={styles.overlay} onClick={closeEdit}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{edit.item.label}</h2>
              <button className={styles.modalClose} onClick={closeEdit}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {edit.item.type === 'image' ? (
                <>
                  <div className={styles.imgPreviewWrap}>
                    {(edit.preview || edit.value) ? (
                      <img
                        src={edit.preview || edit.value}
                        alt="Preview"
                        className={styles.imgPreview}
                      />
                    ) : (
                      <div className={styles.imgPlaceholder}>No image yet — upload one below</div>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                    className={styles.fileInput}
                  />
                  <button className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
                    {edit.value ? 'Replace image' : 'Upload image'}
                  </button>

                  {libraryImages.length > 1 && (
                    <details className={styles.libraryPicker}>
                      <summary>Or choose from image library ({libraryImages.length} images)</summary>
                      <div className={styles.pickerGrid}>
                        {libraryImages.filter(i => i.key !== edit.item.key).map(img => (
                          <button key={img.key} className={styles.pickerCell} onClick={() => reuseImage(img.value)}>
                            <img src={img.value} alt={img.label} />
                          </button>
                        ))}
                      </div>
                    </details>
                  )}

                  <div className={styles.field}>
                    <label>Alt text</label>
                    <input
                      type="text"
                      value={edit.altText}
                      onChange={e => setEdit(prev => prev ? { ...prev, altText: e.target.value } : null)}
                      placeholder="Describe the image for screen readers"
                    />
                  </div>

                  <div className={styles.field}>
                    <label>Caption <span className={styles.optional}>(optional)</span></label>
                    <input
                      type="text"
                      value={edit.caption}
                      onChange={e => setEdit(prev => prev ? { ...prev, caption: e.target.value } : null)}
                      placeholder="Shown below the image if the template supports it"
                    />
                  </div>
                </>
              ) : (
                <div className={styles.field}>
                  <label>
                    {edit.item.type === 'richtext' ? 'Content' : 'Text'}
                    {edit.item.type === 'richtext' && (
                      <span className={styles.optional}> — use \n\n to separate paragraphs</span>
                    )}
                  </label>
                  <textarea
                    value={edit.value}
                    onChange={e => setEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                    className={styles.textarea}
                    rows={edit.item.type === 'richtext' ? 8 : 3}
                  />
                </div>
              )}

              {error && <p className={styles.errorMsg}>{error}</p>}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeEdit}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
