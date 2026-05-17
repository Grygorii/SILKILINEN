import styles from './InstagramGrid.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getInstagramUrl(): Promise<string> {
  try {
    const res = await fetch(`${API}/api/social/platforms`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit);
    if (!res.ok) return 'https://instagram.com/silkilinen';
    const platforms: { key: string; url: string }[] = await res.json();
    const ig = platforms.find(p => p.key === 'instagram');
    return ig?.url || 'https://instagram.com/silkilinen';
  } catch { return 'https://instagram.com/silkilinen'; }
}

type IgPost = {
  id: string;
  media_url: string;
  permalink: string;
  caption: string;
  media_type: string;
  timestamp: string;
};

async function getPosts(): Promise<IgPost[]> {
  try {
    const res = await fetch(`${API}/api/instagram/posts?limit=6`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    } as RequestInit);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function InstagramGrid() {
  const [posts, instagramUrl] = await Promise.all([getPosts(), getInstagramUrl()]);

  // Silently hide the section if no posts
  if (posts.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>@silkilinen</h2>
        <p className={styles.sub}>Follow along for daily inspiration</p>
      </div>
      <div className={styles.grid}>
        {posts.map(post => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cell}
            title={post.caption ? post.caption.slice(0, 100) : undefined}
          >
            {post.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.media_url}
                alt={post.caption ? post.caption.slice(0, 80) : 'Instagram post'}
                className={styles.cellImg}
                loading="lazy"
              />
            )}
            {post.caption && (
              <div className={styles.cellOverlay}>
                <p className={styles.cellCaption}>{post.caption.slice(0, 60)}{post.caption.length > 60 ? '…' : ''}</p>
              </div>
            )}
          </a>
        ))}
      </div>
      <div className={styles.footer}>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.followBtn}
        >
          Follow on Instagram
        </a>
      </div>
    </section>
  );
}
