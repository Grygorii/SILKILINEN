# Three-Reassurance Row — Spec (waiting on content)

> Draft spec for an Olivia von Halle–inspired three-column reassurance row on the homepage. Code is **not** written yet — this doc captures the layout, copy structure, and content questions so Hríša can fill in the actual services before I build it.

Status: 🟡 Awaiting content from founder
Owner to write: 28 May 2026

---

## What it is

A single row of three small reassurance blocks that sits between the hero / new arrivals section and the rest of the homepage. Each block has a small line-icon, a short bold headline (2–4 words), and a one-line subhead that links to a detail page.

OvH reference: their version uses **Gift Wrap**, **Express Shipping**, **Personalisation**. The pattern works because the three items together tell the visitor "this is a luxury service, not a transactional store" — each block is itself a service worth landing on.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│     [icon]              [icon]              [icon]               │
│   HEADLINE A          HEADLINE B          HEADLINE C             │
│  subhead one line   subhead one line   subhead one line          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Desktop:** 3 columns, equal width, generous padding (~64px top/bottom).
**Mobile:** stacks to 1 column on `max-width: 768px`. Generous vertical spacing between blocks.
**Background:** the page cream (`var(--color-bg)`) — no border, no card. The row reads as part of the page rhythm, not a band.
**Icons:** lucide-react line icons at `strokeWidth={1.5}`, ~28px. Same family as the rest of the site.
**Typography:**
- Headline: Cormorant Garamond serif, 18px, letter-spacing 1px, dark ink.
- Subhead: 12px, muted ink-muted colour, line-height 1.6.
- Each block is wrapped in a `<Link>` to its detail page; cursor:pointer, subtle opacity on hover.

---

## Content slots — Hríša to fill

I need **3 service offers** and a **detail-page url** for each. Two of these probably already exist (Shipping page, Returns page); the third may need to be a new page.

| Slot | Headline (2–4 words) | Subhead (one line) | Detail URL | Status |
|---|---|---|---|---|
| 1 | _e.g._ Free EU Shipping | _e.g._ On every order over €150 | `/shipping` | Exists ✅ |
| 2 | _e.g._ 14-day Returns | _e.g._ Easy exchanges, no questions | `/returns` | Exists ✅ |
| 3 | _e.g._ Gift Wrapping | _e.g._ Hand-tied silk ribbon, included | `/gift-wrapping` | **New page needed** |

**Founder picks at minimum:**
- A. What three services to feature (don't have to be the examples above — could be Monogramming, Care Guide, Gift Cards, Express Shipping, etc.).
- B. Whether the third slot needs a new page or links elsewhere.
- C. The exact headline + subhead copy for each.

**My recommendations if no answer:**
1. **Free EU Shipping** / On orders over €150 / `/shipping`
2. **14-day Returns** / Easy exchanges from anywhere / `/returns`
3. **Gift-Ready** / Hand-tied silk ribbon, included / `/gift-wrapping` (new page needed — could be one short page explaining gift wrap is automatic on every order, or add a checkout toggle later)

---

## Code stub (for reference once content lands)

```tsx
// frontend/components/ReassuranceRow.tsx
import Link from 'next/link';
import { Truck, RotateCcw, Gift } from 'lucide-react';
import styles from './ReassuranceRow.module.css';

const ITEMS = [
  { icon: Truck,    headline: 'Free EU Shipping', sub: 'On orders over €150',            href: '/shipping' },
  { icon: RotateCcw, headline: '14-day Returns',   sub: 'Easy exchanges from anywhere',  href: '/returns'  },
  { icon: Gift,      headline: 'Gift-Ready',       sub: 'Hand-tied silk ribbon, included', href: '/gift-wrapping' },
];

export default function ReassuranceRow() {
  return (
    <section className={styles.section}>
      <div className={styles.row}>
        {ITEMS.map(({ icon: Icon, headline, sub, href }) => (
          <Link key={headline} href={href} className={styles.block}>
            <Icon size={28} strokeWidth={1.5} />
            <h3 className={styles.headline}>{headline}</h3>
            <p className={styles.sub}>{sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

Mount in `frontend/app/(shop)/page.tsx` between `<NewArrivals />` and `<CategoryTiles />`.

---

## Open questions for founder

1. **Three services to feature** — please pick from the menu in section above, or write your own list.
2. **Monogramming** — is this a real service you want to offer? If yes, it deserves slot 3. If no, replace with gift wrap or shipping.
3. **Gift wrapping detail** — is gift wrap automatic on every order, or a checkout add-on? Affects whether `/gift-wrapping` is an info page or a service page.
4. **Icons** — happy with line-icon set, or do you want custom hand-drawn iconography (a small but premium upgrade)?

Reply in this doc or in chat; once I have answers I'll build the component, the new detail page (if needed), and ship.
