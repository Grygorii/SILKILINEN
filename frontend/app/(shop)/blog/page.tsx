import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blogPosts';
import styles from './page.module.css';

export const metadata = {
  title: 'Journal — SILKILINEN',
  description: 'Care guides, material stories, and quiet inspiration from the world of silk and linen.',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPage() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>The Journal</p>
        <h1 className={styles.heading}>Stories from SILKILINEN</h1>
        <p className={styles.sub}>Care guides, material stories, and quiet inspiration.</p>
      </div>
      <div className={styles.grid}>
        {BLOG_POSTS.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
            <div className={styles.imgWrap} />
            <div className={styles.cardBody}>
              <p className={styles.date}>{formatDate(post.date)} · {post.readTime}</p>
              <h2 className={styles.cardTitle}>{post.title}</h2>
              <p className={styles.excerpt}>{post.excerpt}</p>
              <span className={styles.readMore}>Read article →</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
