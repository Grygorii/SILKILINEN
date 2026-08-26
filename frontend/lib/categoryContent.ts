// Category page copy: the short introduction above the grid, and the guide
// below it.
//
// ── Why this is a module and not a map inside the route ──
//
// The route's CATEGORY_COPY had seven entries. Four of them — pyjamas, shorts,
// shirts, pillowcases — are retired slugs that 301 away, so their copy could
// never render for anyone. Meanwhile three LIVE categories (sleepwear, lounge,
// home) had no introduction at all and fell through to a generic fallback.
//
// Nobody wrote it wrong. Nine categories were merged into six by
// consolidateCategories.js, and the copy stayed keyed on the old nine — the
// same drift PROJECT_MAP records for config/categories.js itself. Prose has no
// foreign key. So this file is keyed on the canonical slugs ONLY, and a test
// asserts every live category has both an intro and a guide, which is the check
// that would have caught it.
//
// The stranded copy was not deleted: shorts → lounge and pillowcases → home
// were already written for exactly those pieces, so the merge is honoured
// rather than the words thrown away.
//
// ── What the guide may say ──
//
// §21 asks for 300–600 words below the grid covering material, weight, fit,
// care and buying considerations, linking to the Silk Standard, the Care Guide
// and the journal. Educational, factual, and origin-neutral: no manufacture
// claims (ADR 0008), and NO MOMME NUMBER — the weight is per-product and lives
// on the product page. A category page asserting "19 momme" would be inventing
// a spec for a whole shelf, which is the failure the Silk Standard page was
// built to avoid.

export type CategoryGuide = {
  /** Two to four short paragraphs. Rendered below the product grid. */
  body: string[];
};

export type CategoryContent = {
  title: string;
  /** One or two sentences above the grid. §21: keep it short up here. */
  intro: string;
  guide: CategoryGuide;
};

const SILK_CARE_NOTE =
  'Silk is a protein fibre, so heat, bleach and direct sun age it far faster than wearing it does. Cool hand washing and shade drying are most of the job.';

export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  robes: {
    title: 'Silk Robes',
    intro: 'Pure mulberry silk robes for slow mornings, quiet evenings and gifting.',
    guide: {
      body: [
        'A robe is the piece you reach for without thinking, which makes it the one where weight matters most. Lighter silk falls close and packs small; heavier silk hangs with more authority and holds its shape through years of washing. The momme weight of each robe is stated on its own page, because it varies by piece and a number you can check is worth more than an adjective.',
        'Fit is generous by design. A robe is worn over something, so the shoulder and sleeve are cut with room rather than to the body — most people take their usual size, and sizing down only makes sense if you want it close rather than draped.',
        'Look at the edges before anything else. Enclosed seams and a hem that lies flat are what separate a robe you keep from one that frays at the first wash, and they are the least photogenic part of a garment, which is why they are the first thing cut when a price comes down.',
        SILK_CARE_NOTE,
      ],
    },
  },

  sleepwear: {
    title: 'Silk Sleepwear',
    intro: 'Breathable mulberry silk for comfortable nights and unhurried mornings.',
    guide: {
      body: [
        'Silk is worth its price in sleepwear for a physical reason rather than a romantic one: it moves heat and moisture away from skin instead of holding them against it. That is why a silk nightshirt feels cool in summer and is not cold in winter, and why hot sleepers tend to notice the difference in the first week.',
        'The comparison that matters is not silk against cotton but silk against satin. Satin is a weave, not a fibre, and most satin sleepwear is woven polyester — it looks similar in a photograph, and it traps heat, builds static and does none of the things people buy silk for.',
        'Sizing runs true. Sleepwear is cut for movement rather than shape, so take your usual size; between sizes, the larger one sleeps better.',
        SILK_CARE_NOTE,
      ],
    },
  },

  lingerie: {
    title: 'Silk Lingerie',
    intro: 'Pure silk designed to feel as good as it looks, under everything or on its own.',
    guide: {
      body: [
        'Lingerie is where fibre quality is felt most directly, because there is nothing between the fabric and the skin. Long-fibre mulberry silk is smoother than wild varieties and stays smooth — short, irregular fibres are what pill and catch, and they do it fastest where a garment moves against the body all day.',
        'Fit notes are given per piece rather than as a rule, since a slip and a brief are cut to different logics. Where a style runs small or relaxed, its product page says so plainly.',
        'Silk takes dye evenly, which is why the colours read as depth rather than as surface. That same quality is why direct sun is the enemy: it fades silk faster than washing does.',
        SILK_CARE_NOTE,
      ],
    },
  },

  lounge: {
    title: 'Silk Loungewear',
    intro: 'Pure silk shorts and separates for lounging in style. Relaxed fit, refined feel.',
    guide: {
      body: [
        'Loungewear is worn more hours than anything else in the drawer, so it is judged on durability rather than drama. A heavier silk earns its price here: it resists creasing through a day of sitting and keeps its surface where a lighter weight would start to look tired.',
        'Cut is relaxed throughout. These pieces are meant to be lived in rather than fitted, so take your usual size and expect room through the hip and thigh.',
        'Silk and linen both belong in this category and behave differently. Linen creases and is supposed to; the crease is the material telling the truth about itself. Silk does not, which is why the two are rarely blended in the same garment here.',
        SILK_CARE_NOTE,
      ],
    },
  },

  home: {
    title: 'Home & Sleep',
    intro: 'Sleep on pure silk. Gentler on hair and skin, cooler through the night.',
    guide: {
      body: [
        'A silk pillowcase is the least effortful thing in this category and the one people notice first. The fibre is smoother than cotton and absorbs far less, so hair moves across it instead of catching, and whatever you put on your skin at night largely stays there rather than going into the pillow.',
        'Weight matters more in bedding than in clothing, because a pillowcase is washed constantly. A denser silk survives that; a light one goes thin at the seams. Each piece states its own weight on its product page.',
        'Eye masks are judged on the seal rather than the silk — a mask that lets light in at the nose is a mask that does not work, whatever it is made of.',
        SILK_CARE_NOTE,
      ],
    },
  },

  scarves: {
    title: 'Silk Scarves',
    intro: 'Pure silk scarves — worn a hundred ways, remembered for one.',
    guide: {
      body: [
        'A scarf is the one silk piece bought as much for the print as for the fibre, but the fibre decides whether the print lasts. Mulberry silk takes dye evenly and deeply, so the colours hold their saturation through years of folding rather than going chalky at the creases.',
        'Hand-rolled edges are the traditional finish and the reason a good scarf drapes rather than hangs — the weight at the perimeter is what makes it fall into a knot properly. Where a scarf is finished this way, its page says so.',
        'Size changes what a scarf is for. A smaller square is a neck piece; anything approaching 90cm can be worn as a headscarf, tied to a bag, or used as a wrap, which is why it is the size most often bought as a gift.',
        SILK_CARE_NOTE,
      ],
    },
  },
};

/** Copy for a canonical category slug, or null when there is none. */
export function categoryContent(slug?: string | null): CategoryContent | null {
  const key = String(slug || '').trim().toLowerCase();
  return CATEGORY_CONTENT[key] ?? null;
}

/**
 * Where the guide sends the reader next. §68 wants every collection linking to
 * the Silk Standard, the Care Guide and the journal — the same three from every
 * category, so the education pages accumulate links rather than each category
 * inventing its own trail.
 */
export const GUIDE_LINKS = [
  { label: 'What makes silk worth it', href: '/silk-standard' },
  { label: 'How to care for silk', href: '/care-guide' },
  { label: 'From the journal', href: '/journal' },
];

/**
 * Which categories the care guide sends a reader to, in the order it names
 * them. The reciprocal of GUIDE_LINKS above: that sends category readers to the
 * education pages, this sends education readers back to the shelves.
 *
 * Here rather than in the page so it sits under the same canonical-slug test as
 * the copy map. A typo would not throw — the page filters these against the
 * live category list, so a wrong slug simply renders one link fewer, and a
 * quietly shorter row is not something anyone notices.
 */
export const CARE_GUIDE_CATEGORIES = ['robes', 'sleepwear', 'home'];
