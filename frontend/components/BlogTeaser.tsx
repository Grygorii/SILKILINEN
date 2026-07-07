import Link from 'next/link';
import ArticleImage from './ArticleImage';
import { isValidImageUrl } from '@/lib/imageUtils';
import styles from './BlogTeaser.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Article = {
  _id: string; title: string; slug: string; excerpt: string;
  heroImage: { url: string; alt: string };
  publishedAt: string; readingTimeMinutes: number | null;
};

async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API}/api/journal?limit=3`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogTeaser() {
  const posts = await getArticles();
  if (posts.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>From the Journal</h2>
        <Link href="/journal" className={styles.viewAll}>Discover more →</Link>
      </div>
      <div className={styles.grid}>
        {posts.map(post => (
          <Link key={post._id} href={`/journal/${post.slug}`} className={styles.card}>
            <div className={styles.imgWrap}>
              <ArticleImage
                src={isValidImageUrl(post.heroImage?.url) ? post.heroImage?.url : null}
                alt={post.heroImage?.alt || post.title}
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className={styles.cardBody}>
              <p className={styles.date}>
                {formatDate(post.publishedAt)}
                {post.readingTimeMinutes && ` · ${post.readingTimeMinutes} min read`}
              </p>
              <h3 className={styles.cardTitle}>{post.title}</h3>
              <p className={styles.excerpt}>{post.excerpt}</p>
              <span className={styles.readMore}>Read article →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
