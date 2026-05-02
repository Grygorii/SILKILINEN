export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  body: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'caring-for-your-silk',
    title: 'How to Care for Your Silk Pieces',
    excerpt: 'Silk rewards gentle care. A few simple habits will keep your pieces feeling luxurious for years to come.',
    date: '2025-03-10',
    readTime: '4 min read',
    body: [
      "Silk is one of nature's finest fibres — strong yet delicate, with a lustre that synthetic fabrics can only imitate. Like all natural textiles, it responds best to thoughtful handling.",
      'Hand-wash in cool water with a small amount of mild, pH-neutral detergent. Submerge the garment and move it gently through the water — never wring or twist. Rinse thoroughly in cool water until the water runs clear.',
      'To dry, lay flat on a clean white towel, reshape gently, and leave away from direct sunlight and heat. Silk can weaken and fade under prolonged UV exposure, so never tumble dry.',
      'Iron on the lowest setting while the fabric is still slightly damp, on the reverse side. Alternatively, hang in a steamy bathroom — silk relaxes beautifully in gentle humidity.',
      'Store silk folded in acid-free tissue paper or in a breathable cotton bag. Avoid plastic bags, which trap moisture and can cause yellowing over time.',
    ],
  },
  {
    slug: 'the-linen-story',
    title: 'The Linen Story: Ancient Fibre, Modern Comfort',
    excerpt: "Linen has clothed humanity for over 10,000 years. We explore why this ancient fibre is having its most exciting moment yet.",
    date: '2025-02-20',
    readTime: '5 min read',
    body: [
      "Linen is woven from the fibres of the flax plant — one of the first crops cultivated by humans, with archaeological evidence stretching back over 30,000 years. Egyptian pharaohs were buried in it. Roman senators wore it. And today, it's the foundation of some of SILKILINEN's warmest garments.",
      'What makes linen extraordinary is its relationship with temperature. The hollow core of each flax fibre allows it to wick moisture efficiently, releasing it rapidly so the fabric stays dry against your skin. In summer, linen keeps you cool; in cooler months, its natural insulation holds warmth close.',
      'Linen improves with washing. Unlike cotton, which softens to limpness over time, linen develops character — a gentle drape and subtle texture that feels distinctly lived-in. A linen robe worn for five years is often more beautiful than one bought yesterday.',
      'Our linen is sourced from established European mills where flax is processed with minimal water and without synthetic bleaching. The crop itself requires very little irrigation — far less than cotton — making it one of the most environmentally responsible fibres available.',
      'We combine linen with silk for garments that carry the breathability of linen with the softness of silk — a pairing that took months of sampling to perfect.',
    ],
  },
  {
    slug: 'sleep-better-in-silk',
    title: 'Sleep Better in Silk: What the Research Says',
    excerpt: "There's a reason dermatologists and sleep coaches recommend silk. Here's what the evidence actually shows.",
    date: '2025-01-15',
    readTime: '3 min read',
    body: [
      "Silk sleepwear has moved from luxury indulgence to something you're as likely to hear a dermatologist recommend as a fashion editor. But what does the evidence say?",
      'The case begins with temperature regulation. Quality sleep requires your core body temperature to drop by roughly 1–2°C. Silk is a poor thermal conductor — it does not absorb heat quickly or release it dramatically, which helps maintain the stable microclimate that supports deeper sleep stages.',
      "For skin, the argument is about friction and absorption. Cotton is highly absorbent — overnight, it draws moisture from your skin and from any serums or night creams you've applied. Silk's tightly woven protein fibres are far less absorbent, leaving your skin's hydration where you put it.",
      'The amino acids in silk — particularly sericin — have demonstrated mild anti-inflammatory properties in laboratory settings. While sleeping in silk will not substitute for a skincare routine, the low-friction, low-absorption environment it creates is genuinely gentler on sensitive skin and hair.',
      'At SILKILINEN, we use Mulberry silk — the finest grade, produced by silkworms fed exclusively on Mulberry leaves. The resulting filaments are longer, smoother, and more uniform than wild silk grades, translating to the characteristic cool, fluid hand-feel that makes a real difference on a warm night.',
    ],
  },
];
