'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Post = {
  _id: string;
  title: string;
  status: 'draft' | 'ready' | 'posted';
  defaultImages: { url: string; altText: string }[];
  platformVariations: { platformKey: string; enabled: boolean }[];
  postedTo: { platformKey: string }[];
  updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  draft:  { label: 'Draft',  bg: '#f3f3f3', color: '#555' },
  ready:  { label: 'Ready',  bg: '#fff8e1', color: '#b8860b' },
  posted: { label: 'Posted', bg: '#e8f5e9', color: '#2d7d47' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FILTERS = ['all', 'draft', 'ready', 'posted'] as const;

export default function SocialIndexPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const params = filter !== 'all' ? `?status=${filter}` : '';
    fetch(`${API}/api/admin/social/posts${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/api/admin/social/posts`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() || 'Untitled post' }),
    });
    const data = await res.json();
    if (data._id) window.location.href = `/admin/social/${data._id}`;
  }

  const visible = posts.filter(p => filter === 'all' || p.status === filter);
  const drafts = posts.filter(p => p.status !== 'posted');
  const posted = posts.filter(p => p.status === 'posted');

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 300, fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--dark)', margin: 0, letterSpacing: '1px' }}>
              Social
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>
              Compose posts, export to any platform, track what's been posted.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/social/connections" style={{
              padding: '10px 16px', background: 'white', color: 'var(--dark)', border: '1px solid var(--border)',
              textDecoration: 'none', fontSize: 12, letterSpacing: '0.5px', fontFamily: 'inherit',
            }}>
              Connections
            </Link>
            <button onClick={() => setCreating(c => !c)} style={{
              padding: '10px 20px', background: 'var(--dark)', color: 'white', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px',
            }}>
              {creating ? 'Cancel' : '+ New post'}
            </button>
          </div>
        </div>

        {/* Quick-create */}
        {creating && (
          <form onSubmit={createPost} style={{ display: 'flex', gap: 10, marginBottom: 28, padding: '20px 24px', background: 'white', border: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Post title (optional — helps you find it later)…"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: 'var(--dark)' }}
            />
            <button type="submit" style={{ padding: '10px 20px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Create &amp; open
            </button>
          </form>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'inherit', textTransform: 'capitalize', letterSpacing: '0.3px',
              background: filter === f ? 'var(--dark)' : 'white',
              color: filter === f ? 'white' : 'var(--muted)',
            }}>
              {f === 'all' ? `All (${posts.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${f === 'draft' ? drafts.filter(p=>p.status==='draft').length : f === 'ready' ? drafts.filter(p=>p.status==='ready').length : posted.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: 'var(--muted)' }}>
              {filter === 'all'
                ? 'No posts yet. Create one to start composing.'
                : `No ${filter} posts.`}
            </p>
            {filter === 'all' && (
              <button onClick={() => setCreating(true)} style={{ marginTop: 20, padding: '10px 24px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Create first post
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {visible.map(post => {
              const st = STATUS_LABELS[post.status];
              const thumb = post.defaultImages?.[0]?.url;
              const enabledCount = post.platformVariations.filter(v => v.enabled).length;
              const postedCount = post.postedTo.length;
              return (
                <Link key={post._id} href={`/admin/social/${post._id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', border: '1px solid var(--border)', overflow: 'hidden',
                    cursor: 'pointer', transition: 'box-shadow 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    {/* Thumbnail */}
                    <div style={{ height: 130, background: '#f5f2ee', overflow: 'hidden', position: 'relative' }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 2, letterSpacing: '0.8px', textTransform: 'uppercase', background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(post.updatedAt)}</span>
                      </div>
                      <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, fontWeight: 500, color: 'var(--dark)', margin: '0 0 8px', lineHeight: 1.3 }}>
                        {post.title || 'Untitled'}
                      </h3>
                      {enabledCount > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                          {post.status === 'posted'
                            ? `Posted to ${postedCount} platform${postedCount !== 1 ? 's' : ''}`
                            : `${enabledCount} platform${enabledCount !== 1 ? 's' : ''}`}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
