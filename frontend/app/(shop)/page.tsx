import type { Metadata } from 'next';
import styles from './page.module.css';
import Image from 'next/image';
import ReviewsCarousel, { MAX_REVIEWS, type ReviewData } from '@/components/ReviewsCarousel';
import { curateReviews } from '@/lib/reviewCuration';
import NewArrivals from '@/components/NewArrivals';
import StyleFinderBand from '@/components/StyleFinderBand';
import ReassuranceRow from '@/components/ReassuranceRow';
import QualityBand from '@/components/QualityBand';
import CategoryTiles from '@/components/CategoryTiles';
import FeaturedCollections from '@/components/FeaturedCollections';
import StorySection from '@/components/StorySection';
import HeroVideo from '@/components/HeroVideo';
import BlogTeaser from '@/components/BlogTeaser';
import NewsletterBand from '@/components/NewsletterBand';
import InstagramGrid from '@/components/InstagramGrid';
import { EditableText, EditableImage } from '@/components/inline/InlineEdit';
import { getContent, val } from '@/lib/content';
import { getPageMeta } from '@/lib/pageSeo';
import { SITE } from '@/lib/i18n';

// Derive a still poster frame from a Cloudinary hero video, so the slow-connection
// fallback is an actual frame of the video itself (not a mismatched separate photo).
// Cloudinary generates + caches the JPG on first request; so_auto picks a
// representative frame. Falls back to '' for any non-Cloudinary URL.
function videoPosterFrame(videoUrl: string): string {
  if (!videoUrl.includes('/video/upload/')) return '';
  return videoUrl
    .replace('/video/upload/', '/video/upload/so_auto,q_auto,w_1600,c_limit/')
    .replace(/\.(mp4|webm|mov|m4v)$/i, '.jpg');
}

// Self-referencing canonical for the homepage (kept — without it GSC flagged
// "/" as duplicate). Title/description fall back to the layout defaults unless
// an editable page-SEO override is set in admin / by the Rebuild SEO pipeline.
export async function generateMetadata(): Promise<Metadata> {
  const o = await getPageMeta('/');
  return {
    alternates: { canonical: SITE },
    ...(o?.metaTitle ? { title: { absolute: o.metaTitle } } : {}),
    ...(o?.metaDescription ? { description: o.metaDescription } : {}),
  };
}

// Only what the marquee needs. Calling /api/reviews with NO params hits the
// route's unpaginated branch and returned EVERY approved review (~107) — which
// the carousel then doubles for the infinite scroll, so hundreds of review cards
// were serialised into the homepage HTML for a decorative strip. The true
// average/count still come from /summary below, so the social proof stays honest.
// How many the strip shows is the carousel's business — see MAX_REVIEWS there.
// Curation picks exactly that many out of the pool.
// Read a wider slice than we show, so curateReviews has something to choose
// between. Twelve of twelve is not a selection. Still far short of the ~107
// approved reviews the unpaginated branch would return, which is the payload
// problem this limit was introduced to fix.
const REVIEW_POOL = 40;

async function getReviews(): Promise<ReviewData[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews?limit=${REVIEW_POOL}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // The paginated branch returns { reviews, ... }; the legacy one an array.
    const all: ReviewData[] = Array.isArray(data) ? data : (data.reviews ?? []);
    // Most specific first, RATING-BLIND. The average and count shown beside the
    // carousel come from /summary over every approved review, so what leads the
    // strip cannot move the number a customer reads — which is what keeps this
    // curation and not selective presentation.
    return curateReviews(all, MAX_REVIEWS);
  } catch {
    return [];
  }
}

// Brand-wide average + count over EVERY approved review at any rating —
// independent of how many the carousel displays, so the headline figure stays
// accurate however the strip is curated.
//
// This comment used to say "all 4★+ reviews", describing a filter that was
// deliberately removed: computing the average from 4★+ only made it incapable
// of falling below 4.0 whatever customers actually said, while that same figure
// feeds aggregateRating in the product JSON-LD and is therefore asserted to
// Google as fact. /api/reviews/summary has been correct for a while; the
// comment was still advertising the bug, which is how someone "restores" it.
async function getReviewSummary(): Promise<{ average: number; count: number }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews/summary`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { average: 0, count: 0 };
    const d = await res.json();
    return { average: Number(d?.average) || 0, count: Number(d?.count) || 0 };
  } catch {
    return { average: 0, count: 0 };
  }
}

export default async function Home() {
  const [carouselReviews, summary, cms] = await Promise.all([
    getReviews(),
    getReviewSummary(),
    getContent(),
  ]);
  // `val()` falls back per key, so an unreachable CMS just yields code defaults
  // here — these are layout/image slots, not claims that can go stale.
  const content = cms ?? {};

  const withMessage = carouselReviews.filter(r => r.message.trim().length > 0);
  const avg = summary.average;

  const heroImage = val(content, 'homepage_hero_image');
  const heroVideo = val(content, 'homepage_hero_video');
  // The bad-internet still: a frame of the video when one is set, else the photo.
  const heroStill = (heroVideo && videoPosterFrame(heroVideo)) || heroImage;
  // The hero said "pure" three times across two lines and answered only "what
  // is this", never "why this one". These two say the thing no competitor can
  // copy — and say it within the origin rule: designed, founded, shipped, never
  // made or crafted. Both halves are checkable: `findOriginClaims` passes them,
  // and the worldwide claim is the WORLDWIDE fallback tier in shipping.js.
  const heroTitle = val(content, 'homepage_hero_title', 'Silk, designed in Ireland.');
  const heroSubtitle = val(content, 'homepage_hero_subtitle', 'Founded in Donegal. Shipped worldwide.');
  const heroCta = val(content, 'homepage_hero_cta', 'Explore the collection');

  return (
    <main>
      <section className={styles.hero}>
        <EditableImage contentKey="homepage_hero_image" section="homepage">
        {heroStill && (
          // Real <img> with fetchpriority="high" so the browser preloads
          // it immediately on first byte instead of waiting to discover
          // it from a CSS background-image rule. This is the LCP element
          // and was responsible for the 18-second Lighthouse score.
          // When a hero video is set, this still is a frame of that video.
          <Image
            src={heroStill}
            alt={heroTitle}
            fill
            priority
            sizes="100vw"
            className={styles.heroImg}
          />
        )}
        </EditableImage>
        {/* Optional hero video: muted autoplay loop layered over the image.
            The image above stays the LCP element + poster, so Core Web Vitals
            hold; the video is loaded LATE (after the LCP image paints — see
            HeroVideo) and fades in once it can play. Hidden for users who
            prefer reduced motion (see .heroVideo in the stylesheet). */}
        {heroVideo && (
          <HeroVideo src={heroVideo} poster={heroStill || undefined} className={styles.heroVideo} />
        )}
        <div className={styles.heroContent}>
          <EditableText as="h1" contentKey="homepage_hero_title" value={heroTitle} />
          <EditableText as="p" contentKey="homepage_hero_subtitle" value={heroSubtitle} />
          <EditableText as="a" href="/shop" className={styles.heroBtn} contentKey="homepage_hero_cta" value={heroCta} />
        </div>
      </section>

      <NewArrivals />

      {/* Style Finder — a quiet guide for the hesitant first-time visitor.
          Turns "just browsing" into a curated edit (the Warby Parker / Cuyana
          quiz pattern), in the brand's calm voice. The band owns its own
          scroll-reveal ribbon + animated CTA (client component). */}
      <StyleFinderBand />

      {/* Why the price is the price. Sits ABOVE ReassuranceRow because the two
          answer different questions and this is the earlier one: product trust
          ("is it worth it") comes before service trust ("is it safe to buy").
          On the warm surface so two icon-ish rows in sequence don't read as one
          repeated section. */}
      <QualityBand />

      <ReassuranceRow />

      <FeaturedCollections />

      <CategoryTiles content={content} />

      <StorySection content={content} />

      {withMessage.length > 0 && (
        <section className={styles.reviews}>
          <div className={styles.reviewsHeader}>
            <h2 className={styles.reviewsTitle}>What our customers say</h2>
            {summary.count > 0 && (
              <p className={styles.reviewsSummary}>
                <span className={styles.avgStar}>★</span>
                {avg.toFixed(1)} from {summary.count} reviews
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
    </main>
  );
}
