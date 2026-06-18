import type { Metadata } from 'next';
import styles from './page.module.css';
import Image from 'next/image';
import PageTracker from '@/components/PageTracker';
import ReviewsCarousel, { type ReviewData } from '@/components/ReviewsCarousel';
import NewArrivals from '@/components/NewArrivals';
import StyleFinderBand from '@/components/StyleFinderBand';
import ReassuranceRow from '@/components/ReassuranceRow';
import CategoryTiles from '@/components/CategoryTiles';
import FeaturedCollections from '@/components/FeaturedCollections';
import StorySection from '@/components/StorySection';
import BlogTeaser from '@/components/BlogTeaser';
import NewsletterBand from '@/components/NewsletterBand';
import InstagramGrid from '@/components/InstagramGrid';
import { getContent, val } from '@/lib/content';
import { getPageMeta } from '@/lib/pageSeo';

// Self-referencing canonical for the homepage (kept — without it GSC flagged
// "/" as duplicate). Title/description fall back to the layout defaults unless
// an editable page-SEO override is set in admin / by the Rebuild SEO pipeline.
export async function generateMetadata(): Promise<Metadata> {
  const o = await getPageMeta('/');
  return {
    alternates: { canonical: 'https://www.silkilinen.com' },
    ...(o?.metaTitle ? { title: { absolute: o.metaTitle } } : {}),
    ...(o?.metaDescription ? { description: o.metaDescription } : {}),
  };
}

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
  const heroVideo = val(content, 'homepage_hero_video');
  const heroTitle = val(content, 'homepage_hero_title', 'Pure silk, pure comfort.');
  const heroSubtitle = val(content, 'homepage_hero_subtitle', 'Pure silk & linen intimates');
  const heroCta = val(content, 'homepage_hero_cta', 'Shop the collection');

  return (
    <main>
      <section className={styles.hero}>
        {heroImage && (
          // Real <img> with fetchpriority="high" so the browser preloads
          // it immediately on first byte instead of waiting to discover
          // it from a CSS background-image rule. This is the LCP element
          // and was responsible for the 18-second Lighthouse score.
          <Image
            src={heroImage}
            alt={heroTitle}
            fill
            priority
            sizes="100vw"
            className={styles.heroImg}
          />
        )}
        {/* Optional hero video: muted autoplay loop layered over the image.
            The image above stays the LCP element + poster, so Core Web Vitals
            hold; the video fades in once it can play. Hidden for users who
            prefer reduced motion (see .heroVideo in the stylesheet). */}
        {heroVideo && (
          <video
            className={styles.heroVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={heroImage || undefined}
          >
            <source src={heroVideo} />
          </video>
        )}
        <div className={styles.heroContent}>
          <h1>{heroTitle}</h1>
          <p>{heroSubtitle}</p>
          <a href="/shop" className={styles.heroBtn}>{heroCta}</a>
        </div>
      </section>

      {/* Social proof, high up — a considered buyer wants trust before she
          scrolls. Only shown once there are real reviews. */}
      {allReviews.length > 0 && (
        <a href="/reviews" className={styles.proofStrip}>
          <span className={styles.proofStars} aria-hidden="true">★★★★★</span>
          <span>Loved by our customers · From Donegal with love</span>
        </a>
      )}

      <NewArrivals />

      {/* Style Finder — a quiet guide for the hesitant first-time visitor.
          Turns "just browsing" into a curated edit (the Warby Parker / Cuyana
          quiz pattern), in the brand's calm voice. The band owns its own
          scroll-reveal ribbon + animated CTA (client component). */}
      <StyleFinderBand />

      <ReassuranceRow />

      <FeaturedCollections />

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

      <InstagramGrid />
      <PageTracker page="home" />
    </main>
  );
}
