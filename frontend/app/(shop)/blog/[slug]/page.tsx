import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blogPosts';
import styles from './page.module.css';

export function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} — SILKILINEN Journal`,
    description: post.excerpt,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) notFound();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <Link href="/blog" className={styles.back}>← Back to Journal</Link>
        <p className={styles.meta}>{formatDate(post.date)} · {post.readTime}</p>
        <h1 className={styles.title}>{post.title}</h1>
        <p className={styles.excerpt}>{post.excerpt}</p>
      </div>
      <div className={styles.imgPlaceholder} />
      <div className={styles.body}>
        {post.body.map((para, i) => (
          <p key={i} className={styles.para}>{para}</p>
        ))}
      </div>
      <div className={styles.footer}>
        <Link href="/blog" className={styles.back}>← Back to Journal</Link>
      </div>
    </main>
  );
}
