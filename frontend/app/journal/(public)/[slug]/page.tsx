import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sanitizeArticleHtml } from '@/lib/sanitize';
import { safeJsonLd } from '@/lib/safeJsonLd';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  _id: string; title: string; slug: string; excerpt: string; body: string;
  heroImage: { url: string; alt: string; caption: string };
  publishedAt: string; readingTimeMinutes: number | null; author: string;
  metaTitle: string; metaDescription: string;
};

async function getArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API}/api/journal/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Article Not Found' };
  return {
    // Title template appends " | Silkilinen"; build the journal-suffixed
    // version ourselves so we don't end up with "X | Silkilinen Journal | Silkilinen".
    title: { absolute: article.metaTitle || `${article.title} | Silkilinen Journal` },
    description: article.metaDescription || article.excerpt,
    alternates: { canonical: `https://www.silkilinen.com/journal/${slug}` },
    openGraph: {
      type: 'article',
      url: `https://www.silkilinen.com/journal/${slug}`,
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.excerpt,
      images: article.heroImage?.url ? [{ url: article.heroImage.url }] : [],
    },
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  // Article JSON-LD so the journal can earn article rich results.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    ...(article.heroImage?.url ? { image: [article.heroImage.url] } : {}),
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { '@type': 'Person', name: article.author || 'Silkilinen' },
    publisher: {
      '@type': 'Organization',
      name: 'Silkilinen',
      logo: { '@type': 'ImageObject', url: 'https://www.silkilinen.com/og-default.jpg' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.silkilinen.com/journal/${slug}` },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />
      {/* Hero image */}
      {article.heroImage?.url && (
        <div style={{ width: '100%', height: 'clamp(300px, 50vw, 560px)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.heroImage.url} alt={article.heroImage.alt || article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {article.heroImage.caption && (
            <p style={{ textAlign: 'center', fontSize: 11, color: '#9a8e82', letterSpacing: '0.5px', marginTop: 8 }}>
              {article.heroImage.caption}
            </p>
          )}
        </div>
      )}

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 120px' }}>
        {/* Meta */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#9a8e82', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 20 }}>
            {fmtDate(article.publishedAt)}
            {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min read`}
            {` · By ${article.author}`}
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.2, letterSpacing: '1px', margin: '0 0 20px', color: '#1a1510' }}>
            {article.title}
          </h1>
          {article.excerpt && (
            <p style={{ fontSize: 18, fontStyle: 'italic', color: '#6b5f52', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
              {article.excerpt}
            </p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #d0c9be', margin: '32px 0' }} />

        {/* Body */}
        <div
          className={styles.articleBody}
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }}
        />

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #d0c9be' }}>
          <Link href="/journal" style={{ fontSize: 13, color: '#5c35a8', textDecoration: 'none', letterSpacing: '0.5px' }}>
            ← Back to Journal
          </Link>
        </div>
      </article>
    </main>
  );
}
