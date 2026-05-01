import styles from './page.module.css';
import ReviewsCarousel, { type ReviewData } from '@/components/ReviewsCarousel';

async function getReviews(): Promise<ReviewData[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function average(reviews: ReviewData[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.starRating, 0) / reviews.length;
}

export default async function Home() {
  const allReviews = await getReviews();
  const withMessage = allReviews.filter(r => r.message.trim().length > 0);
  const avg = average(allReviews);

  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h2>Pure silk,</h2>
          <h2>pure comfort.</h2>
          <p>Handcrafted silk &amp; linen intimates</p>
          <a href="/shop" className={styles.heroBtn}>Shop the collection</a>
        </div>
      </section>

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
    </main>
  );
}
