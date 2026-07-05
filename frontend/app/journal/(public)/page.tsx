import Link from 'next/link';
import type { Metadata } from 'next';
import { getPageMeta } from '@/lib/pageSeo';
import { clampMeta } from '@/lib/clampMeta';

export async function generateMetadata(): Promise<Metadata> {
  const o = await getPageMeta('/journal');
  return {
    title: o?.metaTitle ? { absolute: o.metaTitle } : 'Journal',
    description: clampMeta(o?.metaDescription || 'Stories about silk, linen, and slow living from Donegal.'),
    alternates: { canonical: 'https://www.silkilinen.com/journal' },
  };
}

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  _id: string; title: string; slug: string; excerpt: string;
  heroImage: { url: string; alt: string };
  publishedAt: string; readingTimeMinutes: number | null; author: string;
};

async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API}/api/journal?limit=20`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function JournalPage() {
  const articles = await getArticles();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 120px' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 300, letterSpacing: '2px', margin: '0 0 12px' }}>
          Journal
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-ink-muted)', letterSpacing: '1px' }}>
          Stories from Donegal
        </p>
      </div>

      {articles.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: 15, fontStyle: 'italic' }}>
          No articles published yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 32 }}>
          {articles.map(a => (
            <Link key={a._id} href={`/journal/${a.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article>
                <div style={{ height: 200, background: 'var(--color-surface)', overflow: 'hidden', marginBottom: 20 }}>
                  {a.heroImage?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.heroImage.url} alt={a.heroImage.alt || a.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} />
                  )}
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-ink-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
                  {fmtDate(a.publishedAt)}
                  {a.readingTimeMinutes && ` · ${a.readingTimeMinutes} min read`}
                </p>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 400, margin: '0 0 10px', lineHeight: 1.3, color: 'var(--color-ink)' }}>
                  {a.title}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-ink-muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
                  {a.excerpt}
                </p>
                <span style={{ fontSize: 12, color: '#5c35a8', letterSpacing: '0.5px' }}>Read article →</span>
              </article>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
