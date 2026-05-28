import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sanitizeArticleHtml } from '@/lib/sanitize';

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
  if (!article) return { title: 'Not Found — SILKILINEN' };
  return {
    title: article.metaTitle || `${article.title} — SILKILINEN Journal`,
    description: article.metaDescription || article.excerpt,
    openGraph: {
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

  // [DEBUG] Bare-minimum render to isolate the 500. If THIS works, the bug
  // is in the body sanitization / dangerouslySetInnerHTML path. If it
  // still 500s, the cause is in generateMetadata, the layout, or fetch.
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px' }}>
      <h1>{article.title}</h1>
      <p>{article.excerpt}</p>
      <p>debug build: {slug} · body length {article.body.length}</p>
      <Link href="/journal">← Back to Journal</Link>
    </main>
  );
}
