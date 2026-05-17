'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Platform = {
  _id: string;
  key: string;
  displayName: string;
  icon: string;
  brandColor: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  pinterest: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
    </svg>
  ),
  facebook: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  threads: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.852 1.206 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.689-2.042 1.47-1.56 1.875-3.854 1.678-5.503h-5.33c-.048 1.596-.536 2.699-1.434 3.348-1.03.75-2.445.846-4.026.725-1.504-.118-2.684-.773-3.321-1.817-.507-.821-.589-1.822-.344-2.838.39-1.62 1.737-2.681 3.638-2.888 1.166-.125 2.485.1 3.755.525l.012.004c.024.008.048.016.072.025.12.04.237.082.351.124.15.053.296.109.44.168l1.058.443.007.003c.024.01.047.02.071.031.23.1.457.2.683.3.2.088.398.176.593.264l.022.01c.23.102.46.204.684.303.086.038.17.074.254.11.21.09.417.179.62.268h.012v.001c.05.022.1.044.148.066.23.102.458.204.682.303.076.033.15.065.225.098.23.1.457.198.682.296.044.019.088.038.132.057.24.103.478.206.716.308.043.018.086.037.128.056.246.105.49.21.734.314.035.015.07.03.104.045l.024.01c.247.106.492.211.737.315.031.013.062.027.093.04.25.107.5.214.748.32.029.012.058.025.087.038.253.108.503.215.753.32.026.011.053.022.079.033.255.109.509.217.761.325.024.01.047.02.07.03.256.109.51.218.764.326.021.009.042.018.062.027.254.108.507.216.76.323.021.009.042.018.063.027.25.106.498.21.747.315l.018.007c.237.099.474.199.71.298l-.002-.001-.002-.001z"/>
    </svg>
  ),
  youtube: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  ),
  twitter_x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

function getPlatformIcon(iconKey: string, color: string) {
  const icon = PLATFORM_ICONS[iconKey];
  return icon ? <span style={{ color }}>{icon}</span> : <span style={{ fontSize: 14 }}>●</span>;
}

function isValidUrl(s: string) {
  if (!s) return true;
  try { new URL(s); return true; } catch { return false; }
}

export default function SocialConnectionsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ key: '', displayName: '', icon: '', brandColor: '#000000', baseUrl: '', sortOrder: 99 });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/social/platforms`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPlatforms(data);
          const u: Record<string, string> = {};
          for (const p of data) u[p.key] = p.url || '';
          setUrls(u);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveUrl(key: string) {
    const url = urls[key] ?? '';
    if (!isValidUrl(url)) {
      setErrors(e => ({ ...e, [key]: 'Must be a valid URL (or empty)' }));
      return;
    }
    setErrors(e => ({ ...e, [key]: '' }));
    setSaving(key);
    try {
      await fetch(`${API}/api/admin/social/platforms/${key}/url`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
      setPlatforms(ps => ps.map(p => p.key === key ? { ...p, url } : p));
    } catch { /* ignore */ }
    setSaving(null);
  }

  async function toggleActive(key: string, isActive: boolean) {
    await fetch(`${API}/api/admin/social/platforms/${key}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setPlatforms(ps => ps.map(p => p.key === key ? { ...p, isActive: !isActive } : p));
  }

  async function addPlatform(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlatform.key || !newPlatform.displayName || !newPlatform.icon) {
      setAddError('key, displayName, and icon are required');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`${API}/api/admin/social/platforms`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlatform),
      });
      if (!res.ok) {
        const d = await res.json();
        setAddError(d.error || 'Failed to create');
        return;
      }
      const p = await res.json();
      setPlatforms(ps => [...ps, p].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)));
      setUrls(u => ({ ...u, [p.key]: p.url || '' }));
      setShowAddModal(false);
      setNewPlatform({ key: '', displayName: '', icon: '', brandColor: '#000000', baseUrl: '', sortOrder: 99 });
    } catch { setAddError('Network error'); }
    setAdding(false);
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <Link href="/admin/social" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Social</Link>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 300, fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--dark)', margin: 0, letterSpacing: '1px' }}>
              Social Connections
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>
              Platform URLs power footer icons, "Follow on Instagram", and email footers.
            </p>
          </div>
          <button onClick={() => setShowAddModal(true)} style={{
            padding: '10px 18px', background: 'var(--dark)', color: 'white', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '0.5px',
          }}>
            + Add platform
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 40 }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {platforms.map(p => (
              <div key={p.key} style={{
                background: 'white', border: '1px solid var(--border)',
                padding: '18px 20px', opacity: p.isActive ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {getPlatformIcon(p.icon, p.brandColor || '#888')}
                  <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--dark)' }}>{p.displayName}</span>
                  {p.url && isValidUrl(p.url) && (
                    <span style={{ fontSize: 10, padding: '1px 6px', background: '#e8f5e9', color: '#2d7d47', borderRadius: 2, letterSpacing: '0.5px' }}>CONNECTED</span>
                  )}
                  {!p.isActive && (
                    <span style={{ fontSize: 10, padding: '1px 6px', background: '#f3f3f3', color: '#888', borderRadius: 2, letterSpacing: '0.5px' }}>HIDDEN</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => toggleActive(p.key, p.isActive)}>
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    value={urls[p.key] ?? ''}
                    onChange={e => setUrls(u => ({ ...u, [p.key]: e.target.value }))}
                    placeholder={`https://${p.icon}.com/silkilinen`}
                    onKeyDown={e => e.key === 'Enter' && saveUrl(p.key)}
                    style={{
                      flex: 1, padding: '8px 12px', border: `1px solid ${errors[p.key] ? '#c62828' : 'var(--border)'}`,
                      fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)',
                    }}
                  />
                  <button
                    onClick={() => saveUrl(p.key)}
                    disabled={saving === p.key}
                    style={{
                      padding: '8px 18px', border: '1px solid var(--border)',
                      background: saved[p.key] ? '#e8f5e9' : 'white',
                      color: saved[p.key] ? '#2d7d47' : 'var(--dark)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, transition: 'all 0.2s',
                    }}
                  >
                    {saving === p.key ? 'Saving…' : saved[p.key] ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
                {errors[p.key] && <p style={{ fontSize: 11, color: '#c62828', marginTop: 4 }}>{errors[p.key]}</p>}
                {p.url && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)' }}>{p.url}</a>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add platform modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
            <div style={{ background: 'white', padding: 32, width: 480, maxWidth: '95vw' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 400, margin: '0 0 20px' }}>Add platform</h2>
              <form onSubmit={addPlatform} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Key (slug) *</label>
                  <input value={newPlatform.key} onChange={e => setNewPlatform(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    placeholder="e.g. instagram, linkedin" required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Display name *</label>
                  <input value={newPlatform.displayName} onChange={e => setNewPlatform(p => ({ ...p, displayName: e.target.value }))}
                    placeholder="Instagram" required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Icon key * <span style={{ fontSize: 10, fontStyle: 'italic' }}>(instagram, pinterest, facebook, tiktok, threads, youtube, twitter_x)</span></label>
                  <input value={newPlatform.icon} onChange={e => setNewPlatform(p => ({ ...p, icon: e.target.value.toLowerCase() }))}
                    placeholder="instagram" required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Brand color</label>
                    <input type="color" value={newPlatform.brandColor} onChange={e => setNewPlatform(p => ({ ...p, brandColor: e.target.value }))}
                      style={{ width: '100%', height: 36, border: '1px solid var(--border)', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Sort order</label>
                    <input type="number" value={newPlatform.sortOrder} onChange={e => setNewPlatform(p => ({ ...p, sortOrder: Number(e.target.value) }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Base URL (optional)</label>
                  <input value={newPlatform.baseUrl} onChange={e => setNewPlatform(p => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://instagram.com/"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                {addError && <p style={{ fontSize: 12, color: '#c62828', margin: 0 }}>{addError}</p>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
                  <button type="submit" disabled={adding} style={{ padding: '10px 24px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {adding ? 'Adding…' : 'Add platform'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
