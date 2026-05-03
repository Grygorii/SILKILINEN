import styles from './page.module.css';
import ReviewsCarousel, { type ReviewData } from '@/components/ReviewsCarousel';
import NewArrivals from '@/components/NewArrivals';
import CategoryTiles from '@/components/CategoryTiles';
import StorySection from '@/components/StorySection';
import BlogTeaser from '@/components/BlogTeaser';
import NewsletterBand from '@/components/NewsletterBand';
import InstagramGrid from '@/components/InstagramGrid';
import { getContent, val } from '@/lib/content';

async function getReviews(): Promise<ReviewData[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function average(reviews: ReviewData[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.starRating, 0) / reviews.length;
}

export default async function Home() {
  const [allReviews, content] = await Promise.all([
    getReviews(),
    getContent(),
  ]);

  const withMessage = allReviews.filter(r => r.message.trim().length > 0);
  const avg = average(allReviews);

  const heroImage = val(content, 'homepage_hero_image');
  const heroTitle = val(content, 'homepage_hero_title', 'Pure silk, pure comfort.');
  const heroSubtitle = val(content, 'homepage_hero_subtitle', 'Handcrafted silk & linen intimates');
  const heroCta = val(content, 'homepage_hero_cta', 'Shop the collection');

  return (
    <main>
      <section
        className={styles.hero}
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <div className={styles.heroContent}>
          <h2>{heroTitle}</h2>
          <p>{heroSubtitle}</p>
          <a href="/shop" className={styles.heroBtn}>{heroCta}</a>
        </div>
      </section>

      <NewArrivals />

      <CategoryTiles content={content} />

      <StorySection content={content} />

      {withMessage.length > 0 && (
        <section className={styles.reviews}>
          <div className={styles.reviewsHeader}>
            <h2 className={styles.reviewsTitle}>What our customers say</h2>
            {allReviews.length > 0 && (
              <p className={styles.reviewsSummary}>
                <span className={styles.avgStar}>★</span>
                {avg.toFixed(1)} from {allReviews.length}+ reviews
              </p>
            )}
          </div>
          <ReviewsCarousel reviews={withMessage} />
          <div className={styles.reviewsFooter}>
            <a href="/reviews" className={styles.reviewsLink}>Read all reviews →</a>
          </div>
        </section>
      )}

      <BlogTeaser />

      <NewsletterBand />

      <InstagramGrid content={content} />
    </main>
  );
}
