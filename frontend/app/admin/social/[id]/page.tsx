'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type ImageItem = { url: string; altText: string; cloudinaryId?: string };
type PlatformVariation = {
  platformKey: string;
  enabled: boolean;
  customCaption: string;
  customHashtags: string[];
  customPrimaryImageIndex?: number;
};
type PostedTo = { platformKey: string; postedAt: string; postedBy: string; note: string };
type Platform = {
  key: string; displayName: string; icon: string; brandColor: string;
  captionMaxChars: number; captionRecommended: number;
  hashtagsAllowed: boolean; hashtagsRecommended: number; hashtagsMax: number;
  imageSpecs: { aspectRatio: string; label: string; pixelWidth: number; pixelHeight: number; isDefault: boolean }[];
  tips: string[];
};
type Post = {
  _id: string; title: string; defaultCaption: string;
  defaultImages: ImageItem[]; defaultHashtags: string[];
  primaryImageIndex: number; platformVariations: PlatformVariation[];
  postedTo: PostedTo[]; status: 'draft' | 'ready' | 'posted';
  postedAt?: string; updatedAt: string;
};

// Inline SVG icons keyed by platform icon field
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  pinterest: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>,
  facebook: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  tiktok: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  threads: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.852 1.206 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.689-2.042 1.47-1.56 1.875-3.854 1.678-5.503h-5.33c-.048 1.596-.536 2.699-1.434 3.348-1.03.75-2.445.846-4.026.725-1.504-.118-2.684-.773-3.321-1.817-.507-.821-.589-1.822-.344-2.838.39-1.62 1.737-2.681 3.638-2.888 1.166-.125 2.485.1 3.755.525z"/></svg>,
  youtube: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  twitter_x: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};

function PlatformIcon({ icon, color }: { icon: string; color: string }) {
  const svg = PLATFORM_ICONS[icon];
  return svg ? <span style={{ color, display: 'inline-flex', alignItems: 'center' }}>{svg}</span>
             : <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />;
}

function hashtagsToString(tags: string[]) { return tags.join(' '); }
function stringToHashtags(s: string): string[] {
  return s.split(/[\s,]+/).map(t => t.trim()).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);
}

export default function SocialComposerPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [activePlatformKey, setActivePlatformKey] = useState<string | null>(null);
  const [variations, setVariations] = useState<Record<string, PlatformVariation>>({});

  // UI state
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportPlatformKey, setExportPlatformKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/social/posts/${id}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/api/admin/social/platforms`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([p, pl]) => {
      setPost(p);
      setTitle(p.title || '');
      setCaption(p.defaultCaption || '');
      setHashtags(hashtagsToString(p.defaultHashtags || []));
      const plArray = Array.isArray(pl) ? pl : [];
      setPlatforms(plArray);

      // Merge stored variations with platform list
      const varMap: Record<string, PlatformVariation> = {};
      for (const v of (p.platformVariations || [])) {
        varMap[v.platformKey] = { ...v, customCaption: v.customCaption || '', customHashtags: v.customHashtags || [] };
      }
      for (const platform of plArray) {
        if (!varMap[platform.key]) {
          varMap[platform.key] = { platformKey: platform.key, enabled: true, customCaption: '', customHashtags: [] };
        }
      }
      setVariations(varMap);
      if (plArray.length > 0) setActivePlatformKey(plArray[0].key);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doAutosave(), 2500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doAutosave = useCallback(async () => {
    setSaving(true);
    await fetch(`${API}/api/admin/social/posts/${id}/autosave`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        defaultCaption: caption,
        defaultHashtags: stringToHashtags(hashtags),
        platformVariations: Object.values(variations),
      }),
    }).catch(() => {});
    setSavedAt(new Date());
    setSaving(false);
  }, [id, title, caption, hashtags, variations]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateAndSave(fn: () => void) { fn(); scheduleAutosave(); }

  async function uploadImages(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('images', f);
    const res = await fetch(`${API}/api/admin/social/posts/${id}/images`, {
      method: 'POST', credentials: 'include', body: fd,
    });
    const updated = await res.json();
    setPost(updated);
    setUploading(false);
  }

  async function deleteImage(index: number) {
    const res = await fetch(`${API}/api/admin/social/posts/${id}/images/${index}`, {
      method: 'DELETE', credentials: 'include',
    });
    const updated = await res.json();
    setPost(updated);
  }

  async function setStatus(status: 'draft' | 'ready' | 'posted') {
    setStatusSaving(true);
    const res = await fetch(`${API}/api/admin/social/posts/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, title, defaultCaption: caption, defaultHashtags: stringToHashtags(hashtags), platformVariations: Object.values(variations) }),
    });
    const updated = await res.json();
    setPost(updated);
    setStatusSaving(false);
  }

  async function togglePostedTo(platformKey: string, currentlyPosted: boolean) {
    const res = await fetch(`${API}/api/admin/social/posts/${id}/posted-to`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformKey, posted: !currentlyPosted }),
    });
    const updated = await res.json();
    setPost(updated);
  }

  async function deletePost() {
    if (!confirm('Delete this post? This will also remove uploaded images from Cloudinary.')) return;
    setDeleting(true);
    await fetch(`${API}/api/admin/social/posts/${id}`, { method: 'DELETE', credentials: 'include' });
    window.location.href = '/admin/social';
  }

  // Derived state for active platform
  const activePlatform = platforms.find(p => p.key === activePlatformKey);
  const activeVariation = activePlatformKey ? variations[activePlatformKey] : null;
  const effectiveCaption = activeVariation?.customCaption || caption;
  const effectiveHashtags = activeVariation?.customHashtags?.length
    ? hashtagsToString(activeVariation.customHashtags)
    : hashtags;

  const enabledVariations = Object.values(variations).filter(v => v.enabled);

  function formatSavedAt() {
    if (!savedAt) return '';
    const secs = Math.floor((Date.now() - savedAt.getTime()) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  }

  if (loading) return <AdminLayout><p style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>Loading…</p></AdminLayout>;
  if (!post) return <AdminLayout><p style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>Post not found.</p></AdminLayout>;

  const postedToKeys = new Set((post.postedTo || []).map(p => p.platformKey));
  const allEnabledPosted = enabledVariations.length > 0 && enabledVariations.every(v => postedToKeys.has(v.platformKey));

  return (
    <AdminLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ─── Left panel: Composer ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', minWidth: 0 }}>
          {/* Nav + status bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Link href="/admin/social" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Social</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                {saving ? 'Saving…' : savedAt ? `Saved ${formatSavedAt()}` : ''}
              </span>
              {/* Status badge + quick change */}
              <select
                value={post.status}
                disabled={statusSaving}
                onChange={e => setStatus(e.target.value as 'draft' | 'ready' | 'posted')}
                style={{
                  fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)',
                  background: post.status === 'posted' ? '#e8f5e9' : post.status === 'ready' ? '#fff8e1' : '#f3f3f3',
                  color: post.status === 'posted' ? '#2d7d47' : post.status === 'ready' ? '#b8860b' : '#555',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="posted">Posted</option>
              </select>
              <button onClick={() => { setShowExport(true); setExportPlatformKey(activePlatformKey); }} style={{
                padding: '7px 16px', background: 'var(--dark)', color: 'white', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              }}>
                Export &amp; track →
              </button>
              <button onClick={deletePost} disabled={deleting} style={{
                padding: '7px 10px', background: 'white', color: '#c62828', border: '1px solid #f5c6c6',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
              }}>
                Delete
              </button>
            </div>
          </div>

          {/* Title */}
          <input
            value={title}
            onChange={e => updateAndSave(() => setTitle(e.target.value))}
            placeholder="Post title…"
            style={{
              width: '100%', padding: '10px 0', fontSize: 24, fontWeight: 300,
              fontFamily: "'Cormorant Garamond', Georgia, serif", border: 'none', borderBottom: '1px solid var(--border)',
              color: 'var(--dark)', outline: 'none', marginBottom: 24, background: 'transparent', boxSizing: 'border-box',
            }}
          />

          {/* Image grid */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Images</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(post.defaultImages || []).map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 100, height: 100 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.altText || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {post.primaryImageIndex === i && (
                    <span style={{ position: 'absolute', top: 3, left: 3, fontSize: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '1px 4px', letterSpacing: '0.5px' }}>MAIN</span>
                  )}
                  <button onClick={() => deleteImage(i)} style={{
                    position: 'absolute', top: 3, right: 3, width: 20, height: 20, border: 'none',
                    background: 'rgba(0,0,0,0.6)', color: 'white', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  width: 100, height: 100, border: '1px dashed var(--border)', background: '#fafafa',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 4, color: 'var(--muted)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
                <span style={{ fontSize: 10 }}>{uploading ? 'Uploading…' : 'Add image'}</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { if (e.target.files) { uploadImages(e.target.files); e.target.value = ''; } }} />
            </div>
          </div>

          {/* Default caption */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Default caption</p>
            <textarea
              value={caption}
              onChange={e => updateAndSave(() => setCaption(e.target.value))}
              placeholder="Write your caption here…"
              rows={6}
              style={{
                width: '100%', padding: '12px 14px', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, resize: 'vertical',
                color: 'var(--dark)', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {/* Default hashtags */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Default hashtags</p>
            <input
              value={hashtags}
              onChange={e => updateAndSave(() => setHashtags(e.target.value))}
              placeholder="#silkilinen #silk #linen"
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {/* Platform tabs */}
          {platforms.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>Per-platform variations</p>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                {platforms.map(p => {
                  const v = variations[p.key];
                  const isActive = activePlatformKey === p.key;
                  const isEnabled = v?.enabled !== false;
                  return (
                    <button key={p.key} onClick={() => setActivePlatformKey(p.key)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', border: `1px solid ${isActive ? p.brandColor || 'var(--dark)' : 'var(--border)'}`,
                      background: isActive ? (p.brandColor || 'var(--dark)') : 'white',
                      color: isActive ? 'white' : isEnabled ? 'var(--dark)' : 'var(--muted)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                      opacity: isEnabled ? 1 : 0.5,
                    }}>
                      <PlatformIcon icon={p.icon} color={isActive ? 'white' : (p.brandColor || '#888')} />
                      {p.displayName}
                    </button>
                  );
                })}
              </div>

              {/* Active variation editor */}
              {activePlatform && activeVariation && (
                <div style={{ background: '#fafafa', border: '1px solid var(--border)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlatformIcon icon={activePlatform.icon} color={activePlatform.brandColor || '#888'} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{activePlatform.displayName}</span>
                      {activePlatform.captionMaxChars && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>max {activePlatform.captionMaxChars} chars</span>
                      )}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={activeVariation.enabled}
                        onChange={() => updateAndSave(() => setVariations(vs => ({
                          ...vs, [activePlatformKey!]: { ...vs[activePlatformKey!], enabled: !vs[activePlatformKey!].enabled }
                        })))} />
                      Include this platform
                    </label>
                  </div>

                  {activeVariation.enabled && (
                    <>
                      {activePlatform.tips?.length > 0 && (
                        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff8e1', border: '1px solid #f0e08a', fontSize: 11, color: '#7a6000', lineHeight: 1.6 }}>
                          {activePlatform.tips.map((tip, i) => <div key={i}>• {tip}</div>)}
                        </div>
                      )}

                      <p style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                        Custom caption <span style={{ fontStyle: 'italic', textTransform: 'none' }}>(leave blank to use default)</span>
                      </p>
                      <textarea
                        value={activeVariation.customCaption || ''}
                        onChange={e => updateAndSave(() => setVariations(vs => ({
                          ...vs, [activePlatformKey!]: { ...vs[activePlatformKey!], customCaption: e.target.value }
                        })))}
                        placeholder={caption || 'Will use default caption…'}
                        rows={5}
                        style={{
                          width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                          fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                          boxSizing: 'border-box', outline: 'none', background: 'white',
                        }}
                      />
                      {activePlatform.captionMaxChars > 0 && (
                        <p style={{ fontSize: 10, color: effectiveCaption.length > activePlatform.captionMaxChars ? '#c62828' : 'var(--muted)', marginTop: 4 }}>
                          {effectiveCaption.length} / {activePlatform.captionMaxChars} characters
                        </p>
                      )}

                      {activePlatform.hashtagsAllowed && (
                        <>
                          <p style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, marginTop: 12 }}>
                            Custom hashtags <span style={{ fontStyle: 'italic', textTransform: 'none' }}>(leave blank to use default)</span>
                          </p>
                          <input
                            value={activeVariation.customHashtags?.join(' ') || ''}
                            onChange={e => updateAndSave(() => setVariations(vs => ({
                              ...vs, [activePlatformKey!]: {
                                ...vs[activePlatformKey!],
                                customHashtags: stringToHashtags(e.target.value)
                              }
                            })))}
                            placeholder={hashtags || '#silkilinen #silk'}
                            style={{
                              width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                              fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: 'white',
                            }}
                          />
                          {activePlatform.hashtagsRecommended > 0 && (
                            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Recommended: {activePlatform.hashtagsRecommended} hashtags</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Posted-to checklist */}
          {post.status !== 'draft' && enabledVariations.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Posting checklist</p>
              <div style={{ background: 'white', border: '1px solid var(--border)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {enabledVariations.map(v => {
                  const platform = platforms.find(p => p.key === v.platformKey);
                  const isPosted = postedToKeys.has(v.platformKey);
                  const postedEntry = (post.postedTo || []).find(p => p.platformKey === v.platformKey);
                  return (
                    <label key={v.platformKey} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isPosted}
                        onChange={() => togglePostedTo(v.platformKey, isPosted)}
                        style={{ width: 15, height: 15 }} />
                      {platform && <PlatformIcon icon={platform.icon} color={platform.brandColor || '#888'} />}
                      <span style={{ fontSize: 13, fontWeight: isPosted ? 500 : 400, color: isPosted ? '#2d7d47' : 'var(--dark)', textDecoration: isPosted ? 'none' : 'none' }}>
                        {platform?.displayName || v.platformKey}
                      </span>
                      {postedEntry && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                          {new Date(postedEntry.postedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </label>
                  );
                })}
                {allEnabledPosted && (
                  <p style={{ fontSize: 12, color: '#2d7d47', margin: '4px 0 0', fontStyle: 'italic' }}>All platforms posted ✓</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right panel: Preview ─── */}
        <div style={{
          width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
          background: '#f9f8f7', overflowY: 'auto', padding: '24px 20px',
        }}>
          <p style={{ fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Preview</p>

          {/* Platform selector for preview */}
          {platforms.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
              {platforms.filter(p => variations[p.key]?.enabled !== false).map(p => (
                <button key={p.key} onClick={() => setActivePlatformKey(p.key)} style={{
                  padding: '3px 8px', fontSize: 10, border: `1px solid ${activePlatformKey === p.key ? p.brandColor || 'var(--dark)' : 'var(--border)'}`,
                  background: activePlatformKey === p.key ? (p.brandColor || 'var(--dark)') : 'white',
                  color: activePlatformKey === p.key ? 'white' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {p.displayName}
                </button>
              ))}
            </div>
          )}

          {/* Phone mockup */}
          <div style={{
            background: 'white', border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Platform header bar */}
            {activePlatform && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlatformIcon icon={activePlatform.icon} color={activePlatform.brandColor || '#888'} />
                <span style={{ fontSize: 11, fontWeight: 500, color: activePlatform.brandColor || 'var(--dark)' }}>{activePlatform.displayName}</span>
              </div>
            )}

            {/* Image preview */}
            <div style={{ background: '#f0ece8', aspectRatio: '1/1', overflow: 'hidden' }}>
              {post.defaultImages?.[post.primaryImageIndex ?? 0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.defaultImages[post.primaryImageIndex ?? 0].url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </div>
              )}
            </div>

            {/* Caption preview */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e8e0d8' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dark)' }}>silkilinen</span>
              </div>
              {effectiveCaption ? (
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--dark)', margin: '0 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <strong>silkilinen</strong>{' '}{effectiveCaption}
                </p>
              ) : (
                <p style={{ fontSize: 11, color: '#ccc', margin: '0 0 8px', fontStyle: 'italic' }}>Caption will appear here…</p>
              )}
              {effectiveHashtags && (
                <p style={{ fontSize: 11, color: '#6c9ec4', margin: 0, lineHeight: 1.5 }}>
                  {effectiveHashtags}
                </p>
              )}
            </div>
          </div>

          {/* Image spec info */}
          {(activePlatform?.imageSpecs?.length ?? 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Image specs</p>
              {activePlatform?.imageSpecs.map((spec, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', padding: '3px 0', borderBottom: '1px solid #eee' }}>
                  <span>{spec.label}{spec.isDefault ? ' ★' : ''}</span>
                  <span>{spec.pixelWidth}×{spec.pixelHeight}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Export & Track Modal ─── */}
      {showExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowExport(false); }}>
          <div style={{ background: 'white', padding: '32px 36px', width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 400, margin: '0 0 20px' }}>Export &amp; track</h2>

            {/* Platform picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {enabledVariations.map(v => {
                const p = platforms.find(pl => pl.key === v.platformKey);
                return (
                  <button key={v.platformKey} onClick={() => setExportPlatformKey(v.platformKey)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                    border: `1px solid ${exportPlatformKey === v.platformKey ? (p?.brandColor || 'var(--dark)') : 'var(--border)'}`,
                    background: exportPlatformKey === v.platformKey ? (p?.brandColor || 'var(--dark)') : 'white',
                    color: exportPlatformKey === v.platformKey ? 'white' : 'var(--dark)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                  }}>
                    {p && <PlatformIcon icon={p.icon} color={exportPlatformKey === v.platformKey ? 'white' : (p.brandColor || '#888')} />}
                    {p?.displayName || v.platformKey}
                    {postedToKeys.has(v.platformKey) && <span style={{ fontSize: 10 }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {exportPlatformKey && (() => {
              const platform = platforms.find(p => p.key === exportPlatformKey);
              const variation = variations[exportPlatformKey];
              const exportCaption = variation?.customCaption || caption;
              const exportHashtags = variation?.customHashtags?.length ? hashtagsToString(variation.customHashtags) : hashtags;
              const fullText = [exportCaption, exportHashtags].filter(Boolean).join('\n\n');
              const mainImage = post.defaultImages?.[post.primaryImageIndex ?? 0];
              const isPosted = postedToKeys.has(exportPlatformKey);

              return (
                <div>
                  {/* Caption copy box */}
                  <p style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Caption</p>
                  <div style={{ position: 'relative', marginBottom: 20 }}>
                    <pre style={{
                      padding: '12px 14px', background: '#f9f8f7', border: '1px solid var(--border)',
                      fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      margin: 0, fontFamily: 'inherit', maxHeight: 200, overflowY: 'auto',
                    }}>
                      {fullText || '(empty caption)'}
                    </pre>
                    <button onClick={async () => {
                      await navigator.clipboard.writeText(fullText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }} style={{
                      position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 10,
                      border: '1px solid var(--border)', background: copied ? '#e8f5e9' : 'white',
                      color: copied ? '#2d7d47' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {copied ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>

                  {/* Image download */}
                  {mainImage?.url && platform?.imageSpecs?.length > 0 && (
                    <>
                      <p style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Download image</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                        {platform.imageSpecs.map((spec, i) => {
                          const cloudUrl = mainImage.url.replace('/upload/', `/upload/c_fill,w_${spec.pixelWidth},h_${spec.pixelHeight}/`);
                          return (
                            <a key={i} href={cloudUrl} download target="_blank" rel="noopener noreferrer" style={{
                              padding: '7px 14px', border: '1px solid var(--border)', fontSize: 11,
                              textDecoration: 'none', color: 'var(--dark)', background: spec.isDefault ? '#f5f2ee' : 'white',
                            }}>
                              ↓ {spec.label} ({spec.pixelWidth}×{spec.pixelHeight})
                            </a>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Mark as posted */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <p style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Posting status</p>
                    <button onClick={() => togglePostedTo(exportPlatformKey, isPosted)} style={{
                      padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid var(--border)',
                      background: isPosted ? '#e8f5e9' : 'var(--dark)',
                      color: isPosted ? '#2d7d47' : 'white',
                    }}>
                      {isPosted ? `✓ Posted to ${platform?.displayName} — unmark?` : `Mark as posted to ${platform?.displayName}`}
                    </button>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowExport(false)} style={{
                padding: '10px 24px', border: '1px solid var(--border)', background: 'white',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
