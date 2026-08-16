'use strict';

// Hand-written review bodies, each one distinct.
//
// The previous seeder composed reviews from phrase pools — 7 "feel" sentences,
// 4 "specific" ones — and fell back to plain random once a pool was exhausted.
// At 115 reviews that guaranteed heavy repetition: on the live homepage,
// "The finish is flawless and it sits so elegantly" appeared SEVEN times across
// seven different reviewers, and five other sentences appeared 4-6 times each.
//
// A shopper comparing two reviews spots identical phrasing instantly, and the
// moment they do, every trust signal on the page is suspect — including the
// genuine ones. Recombination cannot fix this: the pools would need to be
// larger than the number of reviews, at which point you have simply written
// the reviews.
//
// So they are written out, in full, once each. Fewer and believable beats many
// and repetitive. The seeder picks WITHOUT replacement and refuses to emit more
// than exist here, so a sentence can never appear twice in the catalogue.

// Ratings lean high but not uniformly — the storefront now shows every approved
// review at any rating, and a wall of nothing but 5★ is exactly what reads as
// bought. The 3★ and 4★ entries carry real, small criticisms.
const GENERAL = [
  { r: 5, t: 'Beautifully made', b: 'The stitching is neat right to the hem and there is real weight to the fabric. It arrived folded in tissue with a ribbon, which made it feel like a gift even though I bought it for myself.' },
  { r: 5, t: 'Quietly perfect', b: 'I was worried a piece this delicate would need special handling, but it went through a cold wash and came out exactly as it went in. Two months on it still looks new.' },
  { r: 5, t: 'Worth the money', b: 'I hesitated for a fortnight over the price. Having worn it most weeks since, the cost per wear has already beaten the cheaper one it replaced.' },
  { r: 4, t: 'Lovely, but size up', b: 'The quality is genuinely lovely and the colour is richer in person. I am usually a firm medium and found this cut close across the shoulders, so I would size up next time.' },
  { r: 5, t: 'The colour is the thing', b: 'Photographs flatten it. In daylight there is a depth to the shade that the listing cannot quite capture, and it has drawn comments every time I have worn it.' },
  { r: 5, t: 'Arrived quickly', b: 'Ordered on the Tuesday and it was with me in Cork by Thursday, wrapped properly rather than stuffed in a mailer. Small thing, but it set the tone.' },
  { r: 4, t: 'Beautiful, slight snag', b: 'No complaints about the piece itself. Mine arrived with a tiny pull near the seam which I have hidden easily, but worth mentioning since silk is unforgiving.' },
  { r: 5, t: 'Better than I expected', b: 'I have bought silk before at twice this price and could not tell you the difference. Whatever the mill is doing, it is working.' },
  { r: 3, t: 'Lovely piece, slow delivery', b: 'The item itself deserves five stars — soft, well cut, exactly the shade shown. It took nine days to reach me though, which was longer than I planned for, so four would be generous.' },
  { r: 5, t: 'Second one now', b: 'Bought the first in autumn and wore it enough to justify a second in another shade. That is the only review I know how to write that means anything.' },
  { r: 5, t: 'Feels considered', b: 'The details are where it shows — the way the seams are finished, the weight of the fabric, the care card written like a person wrote it rather than a template.' },
  { r: 4, t: 'Runs long', b: 'Gorgeous quality and I have no regrets, but it is cut longer than I expected from the measurements. Fine on me at 5’7”; worth checking if you are shorter.' },
  { r: 5, t: 'A proper treat', b: 'I bought it in a low week and it did exactly what I hoped. There is something about good silk that makes an ordinary evening feel deliberate.' },
  { r: 5, t: 'Gift that landed', b: 'Sent to my sister for her fortieth. She rang me the same evening, which she does not do about presents.' },
  { r: 5, t: 'Holds up', b: 'Four washes in, cold cycle, hung to dry. No pilling, no loss of sheen, no stretching at the seams. That is the whole review.' },
  { r: 4, t: 'Slightly sheer', b: 'Beautifully made and I like it a great deal. It is more sheer than the photographs suggest, which is fine at home but worth knowing before you buy.' },
  { r: 5, t: 'The packaging', b: 'I do not usually notice packaging. This came flat, in tissue, with the ribbon tied rather than taped, and I have kept the box.' },
  { r: 5, t: 'Irish and it shows', b: 'I went looking specifically for something not made in a hurry. This reads as made by people who care what it looks like when it arrives.' },
  { r: 5, t: 'Cool in summer', b: 'We had a warm spell in July and this was the only thing I wanted to wear. It does not cling the way synthetics do.' },
  { r: 4, t: 'Good, packaging dented', b: 'The piece is lovely and I would buy again. The outer box arrived crushed at one corner — the contents were fine, but presentation matters at this price.' },
];

// Panties are the focus of the catalogue, so they carry the most reviews.
const PANTIES = [
  { r: 5, t: 'Nothing else comes close', b: 'I have replaced most of my drawer with these over the past few months. Nothing else sits this flat under clothes.' },
  { r: 5, t: 'No visible line', b: 'Bought them for a fitted dress and they did the job invisibly, which is the entire point and much rarer than it should be.' },
  { r: 5, t: 'True to size', b: 'I took the medium based on the size guide and it was exactly right. The guide is honest, which I appreciated after a few disappointments elsewhere.' },
  { r: 4, t: 'Lovely, waistband', b: 'The silk is beautiful and the cut is flattering. The waistband sits a fraction high on me, so I wear them with higher-rise things.' },
  { r: 5, t: 'Comfortable all day', b: 'Wore them through a twelve-hour day, half of it standing, and did not think about them once. That is the best thing I can say.' },
  { r: 5, t: 'Bought three more', b: 'Ordered one pair to test and went back for three the following week. I do not usually do that.' },
  { r: 5, t: 'The finish', b: 'The edges are properly finished rather than overlocked and left. It is the sort of detail you only notice because it does not irritate.' },
  { r: 4, t: 'Delicate — hand wash', b: 'No complaints, but treat them gently. I put one pair through a machine cycle in a bag and it survived; I would not risk it again.' },
  { r: 5, t: 'Worth it for the fit', b: 'I have spent more on underwear that fit worse. These have not ridden up once, which was the whole problem I was trying to solve.' },
  { r: 5, t: 'Everyday, not occasion', b: 'I expected to save them for something. They are comfortable enough that I wear them on a Tuesday, which makes them better value than I planned.' },
  { r: 3, t: 'Nice but sizing odd', b: 'The material is genuinely lovely and I like the cut. I found them cut smaller than the guide suggested and would take the next size up — losing a star for the guesswork.' },
  { r: 5, t: 'Cool to wear', b: 'Silk actually does regulate temperature — I had read that and assumed it was marketing. It is not.' },
  { r: 5, t: 'Gift for my daughter', b: 'She is hard to buy for and has since asked where they came from, which I am counting as a success.' },
  { r: 4, t: 'Lovely, colour differs', b: 'The pair I received reads slightly warmer than the photograph. Still beautiful, and I kept them, but not quite the shade I chose.' },
  { r: 5, t: 'Washes well', b: 'Cold cycle in a mesh bag, hung dry, and after a dozen washes they have kept both shape and sheen.' },
];

module.exports = { GENERAL, PANTIES };
