'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: 'draft' | 'preview' | 'published';
  heroImage: { url: string; alt: string };
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  updatedAt: string;
  author: string;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: '#f3f3f3', color: '#555' },
  preview:   { label: 'Preview',   bg: '#ede7f6', color: '#5c35a8' },
  published: { label: 'Published', bg: '#e8f5e9', color: '#2d7d47' },
};

const FILTERS = ['all', 'draft', 'preview', 'published'] as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function JournalAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    (async () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`${API}/api/admin/journal${params}`, { credentials: 'include' });
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, [filter]);

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch(`${API}/api/admin/journal`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    const data = await res.json();
    if (data._id) window.location.href = `/admin/journal/${data._id}`;
  }

  const visible = articles.filter(a => filter === 'all' || a.status === filter);

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 960 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 300, fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--dark)', margin: 0, letterSpacing: '1px' }}>
              Journal
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>
              Sabreen&apos;s writing space
            </p>
          </div>
          <button onClick={() => setCreating(c => !c)} style={{
            padding: '10px 20px', background: 'var(--dark)', color: 'white', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px',
          }}>
            {creating ? 'Cancel' : '+ New article'}
          </button>
        </div>

        {/* Quick-create form */}
        {creating && (
          <form onSubmit={createArticle} style={{ display: 'flex', gap: 10, marginBottom: 28, padding: '20px 24px', background: 'white', border: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Article title…"
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
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Article cards */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: 'var(--muted)' }}>
              {filter === 'all'
                ? "No articles yet. When Sabreen writes one, it'll live here."
                : `No ${filter} articles.`}
            </p>
            {filter === 'all' && (
              <button onClick={() => setCreating(true)} style={{ marginTop: 20, padding: '10px 24px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Write the first article
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {visible.map(article => {
              const st = STATUS_LABELS[article.status];
              return (
                <Link key={article._id} href={`/admin/journal/${article._id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', border: '1px solid var(--border)', overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    {/* Thumbnail */}
                    <div style={{ height: 120, background: '#f5f2ee', overflow: 'hidden' }}>
                      {article.heroImage?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={article.heroImage.url} alt={article.heroImage.alt || article.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>

                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 2, letterSpacing: '0.8px', textTransform: 'uppercase', background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(article.updatedAt)}</span>
                      </div>
                      <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 500, color: 'var(--dark)', margin: '0 0 6px', lineHeight: 1.3 }}>
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {article.excerpt}
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
