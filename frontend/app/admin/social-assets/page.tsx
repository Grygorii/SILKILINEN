'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminModal from '@/components/AdminModal';
import { toast } from '@/lib/adminToast';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = 'all' | 'social' | 'email' | 'marketplace';

interface Surface {
  key: string;
  displayName: string;
  category: 'social' | 'email' | 'marketplace';
  targetWidth: number;
  targetHeight: number;
  aspect: string;
  geminiAspect: string;
  postResizeNeeded: boolean;
  logoZone: string;
  seedPrompt: string;
  notes?: string;
}

interface Asset {
  _id: string;
  surface: string;
  prompt: string;
  url: string;
  downloadUrl: string;
  aspect: string;
  isWinner: boolean;
  generatedAt: string;
}

function SurfaceCard({ surface }: { surface: Surface }) {
  const [winner, setWinner] = useState<Asset | null>(null);
  const [candidates, setCandidates] = useState<Asset[]>([]);
  const [prompt, setPrompt] = useState(surface.seedPrompt);
  const [promptDirty, setPromptDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/social-assets?surface=${surface.key}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setWinner(d.winner);
        setCandidates(d.candidates || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [surface.key]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenMessage('');
    try {
      const res = await fetch(`${API}/api/admin/social-assets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ surface: surface.key, prompt }),
      });
      const d = await res.json();
      if (!res.ok) { setGenMessage(d.error || 'Generation failed'); return; }
      setCandidates(prev => [...(d.assets || []), ...prev].slice(0, 8));
      if (d.message) setGenMessage(d.message);
    } catch {
      setGenMessage('Generation failed — check connection.');
    } finally {
      setGenerating(false);
    }
  }, [surface.key, prompt]);

  const handleSetWinner = useCallback(async (asset: Asset) => {
    setWinner(asset);
    setCandidates(prev => prev.map(c => ({ ...c, isWinner: c._id === asset._id })));
    await fetch(`${API}/api/admin/social-assets/${asset._id}/set-winner`, {
      method: 'POST',
      credentials: 'include',
    });
  }, []);

  const handleDelete = useCallback(async (asset: Asset) => {
    const isCurrentWinner = asset._id === winner?._id;
    const msg = isCurrentWinner
      ? 'This is the current winner — deleting it will leave this surface without a winner. Continue?'
      : 'Delete this candidate?';
    if (!confirm(msg)) return;
    if (isCurrentWinner) setWinner(null);
    setCandidates(prev => prev.filter(c => c._id !== asset._id));
    await fetch(`${API}/api/admin/social-assets/${asset._id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }, [winner]);

  // Assign this asset directly as a product image (#14) — reuses the
  // Cloudinary URL via the product images/url route, no download/reupload.
  // The modal replaces the old prompt(): live search, click the product.
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignMatches, setAssignMatches] = useState<{ _id: string; name: string }[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);

  useEffect(() => {
    if (!assignAsset || assignSearch.trim().length < 2) { setAssignMatches([]); return; }
    const t = setTimeout(async () => {
      try {
        const sr = await fetch(`${API}/api/admin/products?search=${encodeURIComponent(assignSearch.trim())}&limit=6`, { credentials: 'include' });
        const data = await sr.json();
        setAssignMatches(Array.isArray(data) ? data : (data.products || []));
      } catch { setAssignMatches([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [assignAsset, assignSearch]);

  const handleAssignToProduct = useCallback((asset: Asset) => {
    setAssignSearch('');
    setAssignMatches([]);
    setAssignAsset(asset);
  }, []);

  async function assignTo(product: { _id: string; name: string }) {
    if (!assignAsset) return;
    setAssignBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/products/${product._id}/images/url`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ url: assignAsset.url }),
      });
      if (res.ok) {
        toast(`Image added to "${product.name}".`);
        setAssignAsset(null);
      } else {
        const d = await res.json().catch(() => ({}));
        toast(d.error || 'Failed to assign image.', 'error');
      }
    } catch {
      toast('Network error.', 'error');
    } finally {
      setAssignBusy(false);
    }
  }

  const handleResetPrompt = useCallback(() => {
    if (promptDirty && !confirm('Reset prompt to seed? Your edits will be lost.')) return;
    setPrompt(surface.seedPrompt);
    setPromptDirty(false);
  }, [surface.seedPrompt, promptDirty]);

  const previewAspect = `${surface.targetWidth} / ${surface.targetHeight}`;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{surface.displayName}</span>
        <span className={styles.cardDims}>{surface.targetWidth}×{surface.targetHeight} · {surface.aspect}</span>
      </div>

      <div className={styles.winnerWrap} style={{ aspectRatio: previewAspect }}>
        {loading ? (
          <div className={styles.previewPlaceholder}><span>Loading…</span></div>
        ) : winner ? (
          <img src={winner.url} alt="Current winner" className={styles.winnerImg} />
        ) : (
          <div className={styles.previewPlaceholder}>
            <span>No winner selected. Generate candidates below.</span>
          </div>
        )}
      </div>

      <div className={styles.promptSection}>
        <div className={styles.promptLabelRow}>
          <span className={styles.promptLabel}>Prompt</span>
          <span className={styles.promptCount}>{prompt.length} chars</span>
        </div>
        <textarea
          className={styles.promptArea}
          value={prompt}
          rows={6}
          onChange={e => { setPrompt(e.target.value); setPromptDirty(true); }}
        />
      </div>

      <div className={styles.cardActions}>
        <button className={styles.resetBtn} onClick={handleResetPrompt} disabled={generating}>
          Reset prompt
        </button>
        <button className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate (4)'}
        </button>
      </div>

      {genMessage && <p className={styles.genMessage}>{genMessage}</p>}

      <div className={styles.candidatesSection}>
        <span className={styles.candidatesLabel}>Recent candidates</span>
        {generating ? (
          <div className={styles.thumbGrid}>
            {[0, 1, 2, 3].map(i => <div key={i} className={styles.thumbSkeleton} />)}
          </div>
        ) : candidates.length > 0 ? (
          <div className={styles.thumbGrid}>
            {candidates.map(asset => (
              <div
                key={asset._id}
                className={`${styles.thumb} ${asset.isWinner ? styles.thumbWinner : ''}`}
              >
                <img src={asset.url} alt="" className={styles.thumbImg} />
                {asset.isWinner && <span className={styles.winnerBadge}>★</span>}
                <div className={styles.thumbOverlay}>
                  {!asset.isWinner && (
                    <button onClick={() => handleSetWinner(asset)} className={styles.overlayBtn}>
                      Set winner
                    </button>
                  )}
                  <button onClick={() => window.open(asset.downloadUrl, '_blank')} className={styles.overlayBtn}>
                    Download
                  </button>
                  <button onClick={() => handleAssignToProduct(asset)} className={styles.overlayBtn}>
                    → Product
                  </button>
                  <button onClick={() => handleDelete(asset)} className={`${styles.overlayBtn} ${styles.overlayBtnDelete}`}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>Click Generate to create your first 4 candidates.</p>
        )}
      </div>

      {surface.notes && <p className={styles.cardNotes}>{surface.notes}</p>}

      {assignAsset && (
        <AdminModal title="Add image to a product" onClose={() => setAssignAsset(null)}>
          <input
            autoFocus
            value={assignSearch}
            onChange={e => setAssignSearch(e.target.value)}
            placeholder="Search products by name…"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e0d9cc', marginBottom: 12, boxSizing: 'border-box' }}
          />
          {assignSearch.trim().length >= 2 && assignMatches.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b6358', margin: '0 0 8px' }}>No products matched.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {assignMatches.map(m => (
              <button
                key={m._id}
                onClick={() => assignTo(m)}
                disabled={assignBusy}
                style={{
                  textAlign: 'left', padding: '10px 12px', fontSize: 13,
                  border: '1px solid #e0d9cc', background: '#fff',
                  cursor: assignBusy ? 'default' : 'pointer',
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default function SocialAssetsPage() {
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [filter, setFilter] = useState<Category>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/social-assets/surfaces`, { credentials: 'include' })
      .then(r => r.json())
      .then(setSurfaces)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? surfaces : surfaces.filter(s => s.category === filter);
  const CATEGORIES: Category[] = ['all', 'social', 'email', 'marketplace'];

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h2>Image Studio</h2>
          <span className={styles.count}>{surfaces.length} surfaces</span>
        </div>

        <div className={styles.filterChips}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`${styles.chip} ${filter === cat ? styles.chipActive : ''}`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className={styles.muted}>Loading surfaces…</p>
        ) : (
          <div className={styles.grid}>
            {filtered.map(surface => (
              <SurfaceCard key={surface.key} surface={surface} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
