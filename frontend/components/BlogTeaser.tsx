import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blogPosts';
import styles from './BlogTeaser.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogTeaser() {
  const posts = BLOG_POSTS.slice(0, 3);
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>From the Journal</h2>
        <Link href="/blog" className={styles.viewAll}>View all →</Link>
      </div>
      <div className={styles.grid}>
        {posts.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
            <div className={styles.imgWrap} />
            <div className={styles.cardBody}>
              <p className={styles.date}>{formatDate(post.date)}</p>
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
