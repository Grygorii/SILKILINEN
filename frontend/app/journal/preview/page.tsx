'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { sanitizeArticleHtml } from '@/lib/sanitize';

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  title: string; excerpt: string; body: string;
  heroImage: { url: string; alt: string; caption: string };
  publishedAt: string | null; readingTimeMinutes: number | null; author: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return 'Draft';
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('No preview token'); return; }
    fetch(`${API}/api/journal/preview?token=${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : Promise.reject('Token expired or invalid'))
      .then(setArticle)
      .catch(() => setError('Preview link has expired. Return to admin to generate a new one.'));
  }, [token]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 15, marginBottom: 20 }}>{error}</p>
        <Link href="/admin/journal" style={{ fontSize: 13, color: '#5c35a8' }}>← Back to Journal admin</Link>
      </div>
    );
  }

  if (!article) {
    return <div style={{ padding: 40, color: 'var(--color-ink-muted)', fontSize: 13 }}>Loading preview…</div>;
  }

  return (
    <main>
      {article.heroImage?.url && (
        <div style={{ width: '100%', height: 'clamp(300px, 50vw, 560px)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.heroImage.url} alt={article.heroImage.alt || article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 120px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--color-ink-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 20 }}>
            {fmtDate(article.publishedAt)}
            {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min read`}
            {` · By ${article.author}`}
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.2, margin: '0 0 20px', color: 'var(--color-ink)' }}>
            {article.title}
          </h1>
          {article.excerpt && (
            <p style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--color-ink-muted)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
              {article.excerpt}
            </p>
          )}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-line)', margin: '32px 0' }} />
        <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }}
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, lineHeight: 1.85, color: 'var(--color-ink)' }} />
      </article>
    </main>
  );
}

export default function JournalPreviewPage() {
  return (
    <>
      {/* PREVIEW MODE banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: '#5c35a8', color: 'white', textAlign: 'center',
        padding: '10px 16px', fontSize: 12, letterSpacing: '1px',
      }}>
        PREVIEW MODE — not yet published · This link expires in 1 hour
      </div>
      <div style={{ paddingTop: 42 }}>
        <Suspense fallback={<div style={{ padding: 40, color: 'var(--color-ink-muted)', fontSize: 13 }}>Loading…</div>}>
          <PreviewContent />
        </Suspense>
      </div>
    </>
  );
}
