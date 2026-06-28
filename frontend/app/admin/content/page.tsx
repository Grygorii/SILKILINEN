'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type ImageSpec = {
  width: number;
  height: number;
  aspectRatio: string;
  orientation: string;
  maxFileSize: string;
  formats: string[];
  usage: string;
  aiPromptHelper: string;
};

const IMAGE_SPECS: Record<string, ImageSpec> = {
  homepage_hero_image: {
    width: 2400, height: 1200, aspectRatio: '2:1', orientation: 'landscape',
    maxFileSize: '3 MB', formats: ['JPG', 'WebP'],
    usage: 'Full-width hero banner, shown on every homepage visitor. Mobile crops the centre.',
    aiPromptHelper: 'Full-width fashion hero, 2400×1200px, 2:1 landscape ratio, soft natural daylight, cream/neutral palette, La Perla aesthetic, wide composition with space for text overlay',
  },
  homepage_story_image: {
    width: 1200, height: 1500, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '2 MB', formats: ['JPG', 'WebP'],
    usage: 'Editorial portrait beside the brand story text on the homepage. Should feel intimate.',
    aiPromptHelper: 'Editorial portrait photography, 1200×1500px, 4:5 portrait aspect ratio, soft natural daylight, cream/neutral palette, La Perla / Toast aesthetic',
  },
  category_tile_robes_image: {
    width: 800, height: 1000, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '1.5 MB', formats: ['JPG', 'WebP'],
    usage: 'Category navigation tile for Robes.',
    aiPromptHelper: 'Fashion editorial, silk robe, 800×1000px, 4:5 portrait, soft daylight, neutral background, model or flat lay',
  },
  category_tile_dresses_image: {
    width: 800, height: 1000, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '1.5 MB', formats: ['JPG', 'WebP'],
    usage: 'Category navigation tile for Dresses.',
    aiPromptHelper: 'Fashion editorial, silk dress, 800×1000px, 4:5 portrait, soft daylight, neutral background',
  },
  category_tile_shorts_image: {
    width: 800, height: 1000, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '1.5 MB', formats: ['JPG', 'WebP'],
    usage: 'Category navigation tile for Shorts.',
    aiPromptHelper: 'Fashion editorial, silk shorts, 800×1000px, 4:5 portrait, soft daylight, neutral background',
  },
  category_tile_shirts_image: {
    width: 800, height: 1000, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '1.5 MB', formats: ['JPG', 'WebP'],
    usage: 'Category navigation tile for Shirts.',
    aiPromptHelper: 'Fashion editorial, silk shirt, 800×1000px, 4:5 portrait, soft daylight, neutral background',
  },
  category_tile_scarves_image: {
    width: 800, height: 1000, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '1.5 MB', formats: ['JPG', 'WebP'],
    usage: 'Category navigation tile for Scarves.',
    aiPromptHelper: 'Fashion editorial, silk scarf, 800×1000px, 4:5 portrait, soft daylight, neutral background',
  },
  about_hero_image: {
    width: 2400, height: 1200, aspectRatio: '2:1', orientation: 'landscape',
    maxFileSize: '3 MB', formats: ['JPG', 'WebP'],
    usage: 'About page full-width top banner.',
    aiPromptHelper: 'Fashion lifestyle, 2400×1200px, 2:1 landscape, atelier or studio setting, warm daylight, minimal editorial',
  },
  about_story_image_1: {
    width: 1200, height: 1500, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '2 MB', formats: ['JPG', 'WebP'],
    usage: 'About page story column — left image.',
    aiPromptHelper: 'Editorial portrait, 1200×1500px, 4:5 portrait, silk fabric detail or model, soft daylight, cream palette',
  },
  about_story_image_2: {
    width: 1200, height: 1500, aspectRatio: '4:5', orientation: 'portrait',
    maxFileSize: '2 MB', formats: ['JPG', 'WebP'],
    usage: 'About page story column — right image.',
    aiPromptHelper: 'Editorial portrait, 1200×1500px, 4:5 portrait, silk fabric detail or model, soft daylight, cream palette',
  },
  instagram_image_1: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 1 (matches Instagram native square format).',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
  instagram_image_2: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 2.',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
  instagram_image_3: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 3.',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
  instagram_image_4: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 4.',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
  instagram_image_5: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 5.',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
  instagram_image_6: {
    width: 1080, height: 1080, aspectRatio: '1:1', orientation: 'square',
    maxFileSize: '1 MB', formats: ['JPG', 'WebP'],
    usage: 'Instagram grid image 6.',
    aiPromptHelper: 'Instagram fashion flat lay, 1080×1080px, 1:1 square, silk garment or lifestyle detail, soft daylight, neutral palette',
  },
};

type ContentItem = {
  _id: string;
  key: string;
  type: 'image' | 'video' | 'text' | 'richtext' | 'url';
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

  // Opened from the Pages list? Scope the editor to that page's sections. Reads
  // the query string client-side (avoids the useSearchParams Suspense rule).
  // Backward-compatible: no params → the full editor with every tab.
  const [allowedSections, setAllowedSections] = useState<string[] | null>(null);
  const [pageLabel, setPageLabel] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const only = params.get('only');
    const initialTab = params.get('tab');
    const page = params.get('page');
    if (only) setAllowedSections(only.split(',').map(s => s.trim()).filter(Boolean));
    if (page) setPageLabel(page);
    if (initialTab) setTab(initialTab);
  }, []);

  // Image Studio winners — selectable as content images (#6), so the founder
  // can reuse an AI-generated winner without download-then-reupload.
  const [studioWinners, setStudioWinners] = useState<{ _id: string; url: string; surfaceLabel: string }[]>([]);
  useEffect(() => {
    fetch(`${API}/api/admin/social-assets/winners`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data) => setStudioWinners(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  type IgStatus = { configured: boolean; cachedPostCount: number; fetchedAt: string | null; tokenRefreshedAt: string | null; lastError: string | null };
  const [igStatus, setIgStatus] = useState<IgStatus | null>(null);
  const [igRefreshing, setIgRefreshing] = useState(false);

  useEffect(() => {
    if (tab !== 'instagram') return;
    fetch(`${API}/api/instagram/status`, { credentials: 'include' })
      .then(r => r.json()).then(setIgStatus).catch(() => {});
  }, [tab]);

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
        const isVideo = edit.item.type === 'video';
        const formData = new FormData();
        formData.append(isVideo ? 'video' : 'image', edit.file);
        const endpoint = isVideo
          ? `${API}/api/content/upload-video?section=${edit.item.section}`
          : `${API}/api/content/upload?section=${edit.item.section}&key=${edit.item.key}`;
        const uploadRes = await fetch(endpoint, { method: 'POST', credentials: 'include', body: formData });
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
    <AdminLayout active="pages">
      <div className={styles.page}>
        <div className={styles.header}>
          {pageLabel && <Link href="/admin/pages" style={{ fontSize: 13, color: 'var(--muted, #8a8680)', textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}>← Pages</Link>}
          <h1 className={styles.title}>{pageLabel ? `Editing: ${pageLabel}` : 'Site Content'}</h1>
          <p className={styles.sub}>Changes go live within 60 seconds</p>
        </div>

        <div className={styles.tabs}>
          {(allowedSections ? TABS.filter(t => allowedSections.includes(t.id)) : TABS).map(t => (
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
            {tab === 'instagram' ? (
              <div style={{ maxWidth: 560 }}>
                <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 8, padding: '24px 28px', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Instagram Connection</h2>
                  {igStatus === null ? (
                    <p style={{ color: '#888', fontSize: 14 }}>Loading status…</p>
                  ) : !igStatus.configured ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e53935', display: 'inline-block' }} />
                        <span style={{ fontSize: 14, color: '#e53935', fontWeight: 500 }}>Not connected</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                        <code style={{ background: '#f4f0eb', padding: '2px 6px', borderRadius: 3 }}>INSTAGRAM_ACCESS_TOKEN</code> is not set in Railway environment variables.
                      </p>
                      <p style={{ fontSize: 13, color: '#666' }}>
                        Follow the setup guide in <code style={{ background: '#f4f0eb', padding: '2px 6px', borderRadius: 3 }}>backend/docs/instagram-setup.md</code> to generate a token and add it to Railway.
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#43a047', display: 'inline-block' }} />
                        <span style={{ fontSize: 14, color: '#43a047', fontWeight: 500 }}>Connected</span>
                        {igStatus.cachedPostCount > 0 && (
                          <span style={{ fontSize: 13, color: '#888', marginLeft: 4 }}>— {igStatus.cachedPostCount} posts cached</span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px', fontSize: 13, marginBottom: 20 }}>
                        <span style={{ color: '#888' }}>Posts fetched</span>
                        <span>{igStatus.fetchedAt ? new Date(igStatus.fetchedAt).toLocaleString() : '—'}</span>
                        <span style={{ color: '#888' }}>Token refreshed</span>
                        <span>{igStatus.tokenRefreshedAt ? new Date(igStatus.tokenRefreshedAt).toLocaleString() : 'Not yet this session'}</span>
                        <span style={{ color: '#888' }}>Auto-refresh</span>
                        <span>Weekly (background job)</span>
                      </div>
                      {igStatus.lastError && (
                        <p style={{ fontSize: 13, color: '#c62828', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
                          Last error: {igStatus.lastError}
                        </p>
                      )}
                      <button
                        onClick={async () => {
                          setIgRefreshing(true);
                          try {
                            await fetch(`${API}/api/instagram/refresh-token`, { method: 'POST', credentials: 'include' });
                            const r = await fetch(`${API}/api/instagram/status`, { credentials: 'include' });
                            setIgStatus(await r.json());
                          } finally {
                            setIgRefreshing(false);
                          }
                        }}
                        disabled={igRefreshing}
                        style={{ fontSize: 13, padding: '8px 16px', border: '1px solid #c5a572', borderRadius: 4, background: '#fff', cursor: igRefreshing ? 'default' : 'pointer', color: '#7a5c2e', opacity: igRefreshing ? 0.6 : 1 }}
                      >
                        {igRefreshing ? 'Refreshing…' : 'Refresh token now'}
                      </button>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#aaa' }}>
                  The homepage Instagram section automatically shows real posts from @silkilinen. No manual uploads needed.
                </p>
              </div>
            ) : tab === 'library' ? (
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
                      ) : item.type === 'video' ? (
                        item.value
                          ? <video src={item.value} className={styles.thumb} muted loop autoPlay playsInline />
                          : <div className={styles.thumbEmpty}>No video</div>
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
                  {(() => {
                    const spec = IMAGE_SPECS[edit.item.key];
                    if (!spec) return null;
                    return (
                      <div className={styles.specPanel}>
                        <p className={styles.specTitle}>Image Requirements</p>
                        <div className={styles.specGrid}>
                          <span className={styles.specLabel}>Dimensions</span>
                          <span className={styles.specValue}>{spec.width} × {spec.height} px</span>
                          <span className={styles.specLabel}>Aspect ratio</span>
                          <span className={styles.specValue}>{spec.aspectRatio} {spec.orientation}</span>
                          <span className={styles.specLabel}>Max size</span>
                          <span className={styles.specValue}>{spec.maxFileSize}</span>
                          <span className={styles.specLabel}>Formats</span>
                          <span className={styles.specValue}>{spec.formats.join(', ')}</span>
                        </div>
                        <p className={styles.specUsage}>{spec.usage}</p>
                        <div className={styles.specPromptRow}>
                          <p className={styles.specPromptText}>{spec.aiPromptHelper}</p>
                          <button
                            className={styles.copyBtn}
                            onClick={() => navigator.clipboard.writeText(spec.aiPromptHelper)}
                          >
                            Copy AI prompt
                          </button>
                        </div>
                      </div>
                    );
                  })()}

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

                  {/* Image Studio winners (#6) — pick one instead of uploading */}
                  {studioWinners.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <p style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                        Or reuse an Image Studio winner
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                        {studioWinners.map(w => (
                          <button
                            key={w._id}
                            onClick={() => reuseImage(w.url)}
                            title={w.surfaceLabel}
                            style={{ padding: 0, border: edit.value === w.url ? '2px solid var(--dark)' : '1px solid var(--border)', background: 'none', cursor: 'pointer', aspectRatio: '1', overflow: 'hidden' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={w.url} alt={w.surfaceLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {(edit.value || edit.preview) && (
                    <button
                      className={styles.uploadBtn}
                      style={{ marginTop: 8, background: 'none', color: 'var(--muted)' }}
                      onClick={() => setEdit(prev => prev ? { ...prev, value: '', preview: null, file: null } : null)}
                    >
                      Remove image
                    </button>
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
              ) : edit.item.type === 'video' ? (
                <>
                  <div className={styles.specPanel}>
                    <p className={styles.specTitle}>Video Requirements</p>
                    <div className={styles.specGrid}>
                      <span className={styles.specLabel}>Format</span>
                      <span className={styles.specValue}>MP4 or WebM</span>
                      <span className={styles.specLabel}>Max size</span>
                      <span className={styles.specValue}>30 MB</span>
                      <span className={styles.specLabel}>Length</span>
                      <span className={styles.specValue}>6–10s seamless loop</span>
                      <span className={styles.specLabel}>Audio</span>
                      <span className={styles.specValue}>Silent — it plays muted</span>
                    </div>
                    <p className={styles.specUsage}>
                      Plays muted on autoplay loop behind the homepage headline. The Hero Image stays
                      as the instant poster and as the fallback on phones / reduced-motion. Leave empty
                      to use just the photo.
                    </p>
                  </div>

                  <div className={styles.imgPreviewWrap}>
                    {(edit.preview || edit.value) ? (
                      <video
                        src={edit.preview || edit.value}
                        className={styles.imgPreview}
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : (
                      <div className={styles.imgPlaceholder}>No video yet — upload one below</div>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={onFileChange}
                    className={styles.fileInput}
                  />
                  <button className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
                    {edit.value ? 'Replace video' : 'Upload video'}
                  </button>
                  {(edit.value || edit.preview) && (
                    <button
                      className={styles.uploadBtn}
                      style={{ marginTop: 8, background: 'none', color: 'var(--muted)' }}
                      onClick={() => setEdit(prev => prev ? { ...prev, value: '', preview: null, file: null } : null)}
                    >
                      Remove video (use photo only)
                    </button>
                  )}
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
