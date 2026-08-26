import type { Metadata } from 'next';
import Link from 'next/link';
import { apiJson } from '@/lib/apiFetch';
import { safeJsonLd } from '@/lib/safeJsonLd';
import { clampMeta } from '@/lib/clampMeta';
import { getPageMeta } from '@/lib/pageSeo';
import { mommeReading } from '@/lib/fabricCare';
import { brand } from '@/lib/brand';
import styles from './page.module.css';

// The SILKILINEN Standard — the education page that turns a price into a
// reason.
//
// Its whole value is that the numbers on it are TRUE, so it reads the live
// catalogue rather than printing a figure. A page that says "19 momme" as a
// brand promise is asserting a spec across a range that does not uniformly have
// one, which is the same class of claim as "Made in Ireland" and fails for the
// same reason: it is a fact about products, written once, in a place nobody
// updates when the products change.
//
// So the weight section states the range the shop actually stocks, computed
// from every active product, and disappears entirely when no product records a
// momme. An empty section is a visible gap someone can fill. A confident wrong
// number is not.

const PATH = '/silk-standard';

type CatalogueProduct = { momme?: string; materialComposition?: string };

async function getMommeRange(): Promise<{ min: number; max: number; count: number } | null> {
  // apiListResult semantics: an outage must not read as "no product has a
  // weight", which would silently delete this section rather than degrade it.
  const data = await apiJson<{ products?: CatalogueProduct[] } | CatalogueProduct[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products?limit=200`,
    { next: { revalidate: 3600 } },
  ).catch(() => null);
  if (!data) return null;

  const products: CatalogueProduct[] = Array.isArray(data) ? data : (data.products ?? []);
  const weights = products
    .map(p => mommeReading(p.momme, p.materialComposition)?.value)
    .filter((v): v is number => typeof v === 'number');

  if (!weights.length) return null;
  return { min: Math.min(...weights), max: Math.max(...weights), count: weights.length };
}

export async function generateMetadata(): Promise<Metadata> {
  const override = await getPageMeta(PATH);
  const title = override?.metaTitle || 'The SILKILINEN Standard — What Makes Silk Worth It';
  const description = clampMeta(override?.metaDescription
    || 'What momme means, why mulberry silk differs from satin, and how weave and finishing decide whether a silk piece lasts a season or a decade.');
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${brand.url}${PATH}` },
    openGraph: { title, description, url: `${brand.url}${PATH}`, siteName: 'Silkilinen', type: 'article' },
  };
}

// Answers we are asked repeatedly and can support. FAQPage structured data is
// only legitimate when the questions genuinely appear on the page — Google
// treats decorative FAQ markup as spam — so this array renders the visible
// section AND the JSON-LD from one source. They cannot drift apart.
const QUESTIONS = [
  {
    q: 'What is momme?',
    a: 'Momme (mm) is the traditional measure of silk weight — the weight in pounds of a 45-inch by 100-yard piece. A higher momme means a denser fabric: more opaque, more substantial in the hand, and slower to show wear. It is the single most useful number on a silk label, because unlike "luxury" or "premium" it can be checked.',
  },
  {
    q: 'Is a higher momme always better?',
    a: 'No, and anyone who tells you otherwise is selling one number. Weight decides drape and durability, but fibre quality, weave, dyeing and finishing decide how a piece actually looks and lasts. A heavy silk finished badly will disappoint next to a lighter one made well. Momme is necessary information, not sufficient.',
  },
  {
    q: 'What is mulberry silk?',
    a: 'Silk from Bombyx mori silkworms fed solely on mulberry leaves. The controlled diet produces a uniform, unusually long fibre, which is why mulberry silk is smoother and stronger than wild varieties, and why it takes colour so evenly.',
  },
  {
    q: 'How is silk different from satin?',
    a: 'Silk is a fibre. Satin is a weave. Much of what is sold as "satin" is woven polyester, which looks similar under shop lights and behaves nothing like silk against skin — it does not breathe, it holds heat, and it builds static. Silk satin is silk fibre in a satin weave: the shine and the substance together.',
  },
  {
    q: 'How long should a silk piece last?',
    a: 'Years, with cool hand washing and shade drying. Silk is a protein fibre, so what shortens its life is heat, bleach and direct sun rather than ordinary wear. Most silk that "wore out" was laundered to death.',
  },
];

export default async function SilkStandardPage() {
  const range = await getMommeRange();

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />

      <header className={styles.header}>
        <p className={styles.eyebrow}>The Standard</p>
        <h1>What makes silk worth it</h1>
        <p className={styles.intro}>
          Silk is sold with adjectives. It is bought, well, on four things you can actually
          check: the fibre, the weight, the weave and the finishing. Here is what each one
          means, and what it does to a garment you will own for years.
        </p>
      </header>

      <div className={styles.inner}>
        <section className={styles.pillar}>
          <h2>The fibre</h2>
          <p>
            We work in mulberry silk — the fibre from silkworms fed solely on mulberry leaves.
            The controlled diet produces a long, uniform filament, which is what makes mulberry
            silk smoother and stronger than wild varieties, and why it takes dye so evenly.
            Length matters more than it sounds: short, irregular fibres are what pill, catch
            and dull.
          </p>
        </section>

        <section className={styles.pillar}>
          <h2>The weight</h2>
          <p>
            Silk weight is measured in momme. A higher number is a denser cloth — more opaque,
            heavier in the hand, slower to show wear. Around 19 is the everyday weight of fine
            silk garments; past 22 a piece starts to feel substantial; 30 is closer to
            upholstery than to something you sleep in.
          </p>
          {range ? (
            <p className={styles.figure}>
              {range.min === range.max
                ? <>Our pieces are woven at <strong>{range.min} momme</strong>.</>
                : <>Our pieces run from <strong>{range.min}</strong> to <strong>{range.max} momme</strong>, chosen per garment.</>}
              {' '}
              <span className={styles.figureNote}>
                Read from {range.count} {range.count === 1 ? 'piece' : 'pieces'} in the current collection — the weight is stated on every product page.
              </span>
            </p>
          ) : (
            // No invented number. The section still teaches what momme is; it
            // simply does not claim a figure the catalogue cannot support.
            <p className={styles.figureNote}>
              The momme weight is stated on each product page where it has been measured.
            </p>
          )}
          <p className={styles.caution}>
            One caution, because the number is easy to weaponise: momme alone does not prove
            quality. It describes density, nothing else. Fibre, weave, dyeing and finishing
            decide whether a piece is good.
          </p>
        </section>

        <section className={styles.pillar}>
          <h2>The weave</h2>
          <p>
            Silk is a fibre; satin is a weave. The confusion is not accidental — a great deal
            of &ldquo;satin&rdquo; sleepwear is woven polyester, which looks similar in a
            photograph and behaves nothing like silk against skin. It does not breathe, it
            holds heat, and it builds static. Silk satin is silk fibre in a satin weave: the
            shine and the substance in the same cloth.
          </p>
        </section>

        <section className={styles.pillar}>
          <h2>The finishing</h2>
          <p>
            Where a piece is judged, in the end. Seams that are enclosed rather than
            overlocked, hems that lie flat, edges that do not fray at the first wash. It is
            the least photogenic part of a garment and the part you notice for years — which
            is exactly why it is the first thing cut when a price has to come down.
          </p>
        </section>

        <section className={styles.pillar}>
          <h2>The care</h2>
          <p>
            Silk is a protein fibre, so it is undone by heat, bleach and direct sun rather
            than by wearing it. Cool hand washing and shade drying are most of the job. Most
            silk that &ldquo;wore out&rdquo; was laundered to death.
          </p>
          <p>
            <Link href="/care-guide" className={styles.link}>Read the full care guide →</Link>
          </p>
        </section>

        <section className={styles.faq}>
          <h2>Questions we are asked</h2>
          <dl>
            {QUESTIONS.map(({ q, a }) => (
              <div key={q} className={styles.qa}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.close}>
          <p>
            SILKILINEN is an Irish-founded brand. Every piece is designed in Donegal and
            shipped worldwide, and the fibre, weight and care are stated on each product page
            so you can check them rather than take our word for it.
          </p>
          <Link href="/shop" className={styles.cta}>Shop the collection</Link>
        </section>
      </div>
    </main>
  );
}
