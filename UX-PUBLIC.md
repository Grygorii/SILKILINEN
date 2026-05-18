# UX & Copy Audit — Public / Customer-Facing
**Silkilinen · May 2026**
Voice reference: "Slowly, SILKILINEN." Quiet, considered, editorial. No exclamation marks. No generic e-commerce idiom.

---

## HIGH

---

### H1 — Missing 404 page
**Where:** `frontend/app/not-found.tsx` — does not exist  
**What's wrong:** Next.js serves its own generic 404 when a route is not found. It has no brand typography, no navigation back into the site, and no copy. A customer who follows a dead link lands in a foreign-feeling page with zero SILKILINEN context.  
**Proposed change:** Create `frontend/app/not-found.tsx`:
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: '120px 8% 80px', minHeight: '60vh' }}>
      <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 24 }}>
        404
      </p>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,5vw,52px)', fontWeight: 300, marginBottom: 32 }}>
        This page has moved on.
      </h1>
      <Link href="/shop" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', borderBottom: '1px solid currentColor', paddingBottom: 2 }}>
        Return to the collection
      </Link>
    </main>
  );
}
```

---

### H2 — Missing error boundary page
**Where:** `frontend/app/error.tsx` — does not exist  
**What's wrong:** An unhandled runtime error renders Next.js's default error page. Same problem as H1 — outside brand, no escape route.  
**Proposed change:** Create `frontend/app/error.tsx`:
```tsx
'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: '120px 8% 80px', minHeight: '60vh' }}>
      <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 24 }}>
        Something went wrong
      </p>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, marginBottom: 32 }}>
        We couldn't load this page.
      </h1>
      <button
        onClick={reset}
        style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid currentColor', paddingBottom: 2 }}
      >
        Try again
      </button>
    </main>
  );
}
```

---

### H3 — Emoji icons in account cards
**Where:** [`frontend/app/(shop)/account/page.tsx:40,46,52,58`](frontend/app/(shop)/account/page.tsx#L40)  
**What's wrong:**
```tsx
<span className={styles.cardIcon}>📦</span>  // Orders
<span className={styles.cardIcon}>♥</span>   // Wishlist
<span className={styles.cardIcon}>👤</span>  // Profile
<span className={styles.cardIcon}>📍</span>  // Addresses
```
Emoji renders differently across OS, color-heavy, and completely inconsistent with the icon vocabulary used everywhere else in the site (Lucide, strokeWidth 1.5, monochrome). They signal a template or AI-generated account page.  
**Proposed change:** Replace with Lucide SVGs matching the site's existing icon style (Package, Heart, User, MapPin — all already installed via lucide-react):
```tsx
import { Package, Heart, User, MapPin } from 'lucide-react';
// ...
<Package size={18} strokeWidth={1.5} />   // Orders
<Heart   size={18} strokeWidth={1.5} />   // Wishlist
<User    size={18} strokeWidth={1.5} />   // Profile
<MapPin  size={18} strokeWidth={1.5} />   // Addresses
```

---

### H4 — Welcome banner: exclamation mark and generic copy
**Where:** [`frontend/app/(shop)/account/page.tsx:29`](frontend/app/(shop)/account/page.tsx#L29)  
**What's wrong:**
```
Welcome to SILKILINEN, {name}! Your account is ready.
```
The exclamation mark is the single clearest tell against the brand voice. "Your account is ready" is filler — the customer has just created an account, they know it's ready.  
**Proposed change:**
```
Your SILK10 code is ready — 10% off your first order.
```
Move the promo code to the leading position (the only thing worth saying here). Drop the welcome greeting entirely — the page header `Hello, {name}` already handles that.

---

### H5 — Emoji in Drop a Hint button
**Where:** [`frontend/components/ProductOptions.tsx`](frontend/components/ProductOptions.tsx) (Drop a Hint trigger button)  
**What's wrong:** `🎁 DROP A HINT` — a gift-emoji in an editorial product page is jarring. The surrounding typography is serif, restrained, measured. This reads like a marketplace listing.  
**Proposed change:** Remove the emoji. Keep the label as-is or soften casing:
```tsx
// Before
🎁 DROP A HINT

// After — option A (keep current screaming caps convention of the button row)
DROP A HINT

// After — option B (softer, matches the rest of the PDP tone)
Drop a hint
```
Option A is the minimal fix. Option B is more on-brand but requires consistency check against the ADD TO BAG button style.

---

### H6 — Popup discount button: screaming caps
**Where:** [`frontend/components/EmailCapturePopup.tsx`](frontend/components/EmailCapturePopup.tsx) (submit button, ~line 121)  
**What's wrong:** `GET 10% OFF` — all-caps CTA on a modal that is the customer's first active interaction with SILKILINEN. The eyebrow copy was reportedly "PURE SILK, PURE COMFORT" which compounds it.  
**Proposed change:**
- Button: `Join the circle` (matches the NewsletterBand's established copy) or simply `Claim your 10%`
- Eyebrow: Remove or replace with something specific — `Pure silk. Pure linen. Made in Donegal.`
- If the button text must include the discount, `Get 10% off` (sentence case) is acceptable.

---

### H7 — Order confirmation: generic copy
**Where:** [`frontend/app/(shop)/success/page.tsx:25-26`](frontend/app/(shop)/success/page.tsx#L25)  
**What's wrong:**
```
Thank you for your purchase. You will receive a confirmation email shortly.
Continue shopping
```
This is the most important moment of customer trust — payment just cleared. "Thank you for your purchase" is the default Shopify line. "Continue shopping" is the generic conversion pattern that every e-commerce template uses.  
**Proposed change:**
```tsx
<h1>Order confirmed.</h1>
<p>You'll receive a confirmation to your email. We'll be in touch as it makes its way to you.</p>
<a href="/shop" className={styles.btn}>Back to the collection</a>
```
"Back to the collection" is calm and on-brand. It doesn't treat the customer as a conversion unit.

---

## MEDIUM

---

### M1 — "Added to cart" / "View cart" toast (inconsistency with "bag")
**Where:** [`frontend/components/AddedToCartToast.tsx:39,45`](frontend/components/AddedToCartToast.tsx#L39)  
**What's wrong:**
```tsx
<span className={styles.msg}>Added to cart</span>
// ...
<button ...>View cart</button>
```
Every other surface in the site uses "bag": the product page CTA is "ADD TO BAG", the navigation icon is a bag. "Cart" is the Amazon/Shopify default. The inconsistency is noticeable when a customer uses both surfaces in the same session.  
**Proposed change:**
```tsx
<span className={styles.msg}>Added to your bag</span>
<button ...>View bag</button>
```

---

### M2 — Wishlist "Add to cart" button
**Where:** [`frontend/app/(shop)/account/wishlist/page.tsx:45`](frontend/app/(shop)/account/wishlist/page.tsx#L45)  
**What's wrong:** Same inconsistency as M1. The wishlist move-to-bag action reads "Add to cart".  
**Proposed change:**
```tsx
// Before
<button className={styles.wishBtn} onClick={() => moveToCart(p)}>Add to cart</button>

// After
<button className={styles.wishBtn} onClick={() => moveToCart(p)}>Move to bag</button>
```
"Move to bag" is more precise (the item also leaves the wishlist) and on-brand.

---

### M3 — Wishlist empty state: generic
**Where:** [`frontend/app/(shop)/account/wishlist/page.tsx:28-29`](frontend/app/(shop)/account/wishlist/page.tsx#L28)  
**What's wrong:**
```
Your wishlist is empty.
Browse the collection
```
Functional, but flat. A customer who lands here has an account — they chose to engage. The empty state can do more.  
**Proposed change:**
```tsx
<p>Nothing saved yet.</p>
<a href="/shop">Explore the collection</a>
```
"Nothing saved yet" is quieter and less accusatory than "is empty". "Explore" over "Browse" is a light preference — both are acceptable.

---

### M4 — Orders empty state
**Where:** [`frontend/app/(shop)/account/orders/page.tsx`](frontend/app/(shop)/account/orders/page.tsx) (~line 53)  
**What's wrong:** `No orders yet.` / `Browse the collection →`  
Same pattern as M3 — functional but generic. The "→" arrow appended inline is inconsistent with how arrows appear elsewhere (separate `navArrow` element, never glued to body copy).  
**Proposed change:**
```
Nothing to show yet.
[Explore the collection]  ← as a styled link, arrow separate or omitted
```

---

### M5 — Validation copy in machine voice
**Where:** [`frontend/components/ProductOptions.tsx:47-50`](frontend/components/ProductOptions.tsx#L47)  
**What's wrong:**
```
PLEASE SELECT A COLOUR
PLEASE SELECT A SIZE
```
"PLEASE SELECT A —" is the most recognisable generic e-commerce validation pattern. It speaks at the customer, not with them. The all-caps adds urgency the brand doesn't want.  
**Proposed change:**
```tsx
// Option A — still instructional but softer
ctaLabel = 'Select a colour to continue';
ctaLabel = 'Select a size to continue';

// Option B — fully minimal
ctaLabel = 'Choose a colour';
ctaLabel = 'Choose a size';
```
Either option works. The key change is dropping "PLEASE" and removing the all-caps treatment for these states (the ADD TO BAG button can stay caps if that's the design convention — the disabled error state shouldn't scream).

---

### M6 — Story section pull quote: generic
**Where:** [`frontend/components/StorySection.tsx`](frontend/components/StorySection.tsx) (~line 27)  
**What's wrong:** `"Made with love, worn with intention."` — this is the copywriting equivalent of a stock photo. It says nothing specific about SILKILINEN that any artisan brand couldn't also say.  
**Proposed change:** Replace with something grounded in the actual brand story. The journal articles and welcome email give the right register:
> "A small Donegal studio, slow by design."

or pull from existing verified brand copy:
> "Every piece crafted by hand in Donegal, in considered batches."

The exact wording should come from the founder — flag this for review rather than substituting another placeholder.

---

## LOW

---

### L1 — Announcement bar: generic sentiment
**Where:** [`frontend/components/AnnouncementBar.tsx`](frontend/components/AnnouncementBar.tsx) (~line 10)  
**What's wrong:** `Handmade in Ireland with love` — "with love" is the most widely-used phrase in the handmade goods category. It adds no information and signals a template.  
**Proposed change:**
```
Made by hand in Donegal — silk and linen, in small batches
```
Or cycle it with shipping copy if the bar already supports multiple messages.

---

## Summary table

| ID | File | Issue | Severity |
|----|------|-------|----------|
| H1 | `app/not-found.tsx` (missing) | No branded 404 page | HIGH |
| H2 | `app/error.tsx` (missing) | No branded error page | HIGH |
| H3 | `account/page.tsx:40–58` | Emoji icons in account cards | HIGH |
| H4 | `account/page.tsx:29` | Exclamation + generic welcome copy | HIGH |
| H5 | `ProductOptions.tsx` | `🎁` emoji on Drop a Hint | HIGH |
| H6 | `EmailCapturePopup.tsx` | `GET 10% OFF` screaming caps | HIGH |
| H7 | `success/page.tsx:25–26` | "Thank you for your purchase" + "Continue shopping" | HIGH |
| M1 | `AddedToCartToast.tsx:39,45` | "Added to cart" / "View cart" vs "bag" | MEDIUM |
| M2 | `account/wishlist/page.tsx:45` | "Add to cart" on wishlist | MEDIUM |
| M3 | `account/wishlist/page.tsx:28` | "Your wishlist is empty." | MEDIUM |
| M4 | `account/orders/page.tsx` | "No orders yet." | MEDIUM |
| M5 | `ProductOptions.tsx:47–50` | "PLEASE SELECT A COLOUR/SIZE" | MEDIUM |
| M6 | `StorySection.tsx:27` | Generic pull quote | MEDIUM |
| L1 | `AnnouncementBar.tsx:10` | "Handmade in Ireland with love" | LOW |

**Implementation order:** H1–H2 first (zero content risk, pure addition), then H3, H7, H4, H5, H6, then the mediums in any order.

---

## Responsive audit

All breakpoints checked: 320px, 375px, 414px, 768px, 1024px, 1280px, 1440px.
Analysis is from CSS and component code — items marked **[VISUAL-CHECK-NEEDED]** require browser devtools to confirm.

---

### Fixed-header offset — all pages

**Breakpoints affected:** 601–767px  
**Where:** [`frontend/app/globals.css:43`](frontend/app/globals.css#L43) + [`frontend/components/Navbar.module.css:255`](frontend/components/Navbar.module.css#L255)  
**What breaks:** `shopContent` has `padding-top: 74px` for `max-width: 767px`, but at 601–767px the announcement bar is still 38px (the 30px shortening only kicks in at ≤600px), making the fixed header bottom edge land at 38 + 76 = **114px** — 40px above the content start. Any page whose first content element has no additional top padding will be partially hidden under the navbar.  
**Fix:** Split the mobile padding rule into two breakpoints:
```css
/* globals.css */
@media (max-width: 767px) {
  .shopContent { padding-top: 114px; } /* 38px bar + 76px nav */
}
@media (max-width: 600px) {
  .shopContent { padding-top: 106px; } /* 30px bar + 76px nav */
}
```
**[VISUAL-CHECK-NEEDED]** — open devtools at 650px, scroll to top, inspect whether `h1` on the account or shop page is visible or clipped by the navbar.

---

### Navbar icon overflow — 320–414px

**Breakpoints affected:** 320–414px  
**Where:** [`frontend/components/Navbar.module.css:30`](frontend/components/Navbar.module.css#L30) + [`frontend/components/Navbar.module.css:66`](frontend/components/Navbar.module.css#L66)  
**What breaks:** Three icon buttons in `.navRight` each have `min-width: 44px; flex-shrink: 0` (total 132px). The `.nav` is a 3-column grid (`1fr auto 1fr`); the center auto column ("SILKILINEN" in Cormorant Garamond 18px + letter-spacing: 3px ≈ 130–150px) leaves ≈80–100px for the right column at 320px, which is less than the 132px the buttons need. The rightmost icon (bag) may be clipped.  
**Fix:** On the narrowest phones, reduce the icon button target width while keeping the touch target via padding:
```css
@media (max-width: 380px) {
  .navRight { gap: 0; }
  .iconBtn  { min-width: 36px; padding: 0 4px; }
}
```
**[VISUAL-CHECK-NEEDED]** — test at 320px in devtools; if the cart badge icon is fully visible, this is a non-issue; if it clips, apply the fix above.

---

### Product detail page — sticky info column clips under navbar

**Breakpoints affected:** 1024–1440px (desktop, when scrolled)  
**Where:** [`frontend/app/(shop)/product/[id]/page.module.css:26`](frontend/app/(shop)/product/[id]/page.module.css#L26)  
**What breaks:** `.infoCol { position: sticky; top: 100px; }`. The fixed header height is announcement bar (38px) + navbar (92px) = **130px**. When the sticky column reaches its stuck position, its top edge sits at 100px from the viewport — 30px inside the navbar. The back link and first 30px of the product name are rendered behind the navbar.  
**Fix:**
```css
.infoCol {
  top: 140px; /* 38px bar + 92px nav + 10px breathing room */
  max-height: calc(100vh - 160px);
}
```

---

### Product detail page — colour/size picker below 44px touch target

**Breakpoints affected:** 320–1440px (all widths — this is a component-level size issue)  
**Where:** [`frontend/components/ProductOptions.module.css:44`](frontend/components/ProductOptions.module.css#L44)  
**What breaks:** `.colourCube { padding: 8px 14px; font-size: 11px; }` — total height 8+18+8 = **34px**. Below the 44px minimum on every screen size, but especially consequential on mobile where tap precision is lower.  
**Fix:**
```css
.colourCube {
  padding: 12px 14px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
```

---

### Product detail page — quantity stepper below 44px

**Breakpoints affected:** 320–768px (mobile, where touch is the primary input)  
**Where:** [`frontend/components/ProductOptions.module.css:128`](frontend/components/ProductOptions.module.css#L128)  
**What breaks:** `.stepperBtn { width: 40px; height: 40px; }` — 4px below the 44px minimum. Adjacent to the primary Add to Bag CTA, so a mis-tap on the stepper is likely.  
**Fix:**
```css
.stepperBtn { width: 44px; height: 44px; }
.stepperVal { width: 44px; height: 44px; line-height: 44px; }
```

---

### Drop a Hint button — below 44px touch target

**Breakpoints affected:** 320–768px  
**Where:** [`frontend/components/ProductOptions.module.css:187`](frontend/components/ProductOptions.module.css#L187)  
**What breaks:** `.hintBtn { padding: 4px 0; }` — total height 4+18+4 = **26px**. The Drop a Hint trigger is effectively invisible as a tap target on mobile.  
**Fix:**
```css
.hintBtn {
  padding: 0;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
```

---

### Cart drawer quantity steppers — below 44px

**Breakpoints affected:** 320–768px  
**Where:** [`frontend/components/CartPanel.module.css:203`](frontend/components/CartPanel.module.css#L203)  
**What breaks:** `.stepBtn { width: 36px; height: 36px; }` — 8px below the minimum. The quantity stepper in the cart drawer is the most frequently tapped element after the checkout button, making this the highest-impact touch-target miss.  
**Fix:**
```css
.stepBtn { width: 44px; height: 44px; }
.stepVal { width: 44px; height: 44px; line-height: 44px; }
.stepperWrap { height: 44px; }
```

---

### SideMenu social icon links — no touch target

**Breakpoints affected:** 320–1024px (all screen sizes where the menu is used)  
**Where:** [`frontend/components/SideMenu.module.css:197`](frontend/components/SideMenu.module.css#L197)  
**What breaks:** `.socialLink { display: flex; align-items: center; }` — the SVG icons are 17×17px with no padding or min-height. The tap target is effectively the 17px icon square — far below 44px.  
**Fix:**
```css
.socialLink {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
```
Remove `gap: 20px` from `.social` and let the min-width on each link provide the spacing, or set `gap: 4px` after the fix.

---

### Wishlist action buttons — below 44px

**Breakpoints affected:** 320–768px  
**Where:** [`frontend/app/(shop)/account/account.module.css:447`](frontend/app/(shop)/account/account.module.css#L447)  
**What breaks:** `.wishBtn { padding: 10px 8px; font-size: 10px; }` — total height ≈ 10+16+10 = **36px**. The "Move to bag" and "Remove" buttons sit side-by-side in a narrow card footer; at 375px each button is about 130px wide and 36px tall.  
**Fix:**
```css
.wishBtn {
  padding: 14px 8px;
  min-height: 44px;
}
```

---

### Sticky z-index — announcement bar above navbar

**Breakpoints affected:** 320–1440px  
**Where:** [`frontend/components/AnnouncementBar.module.css:12`](frontend/components/AnnouncementBar.module.css#L12) + [`frontend/components/Navbar.module.css:11`](frontend/components/Navbar.module.css#L11)  
**What breaks:** AnnouncementBar has `z-index: 150`; Navbar has `z-index: 100`. This ordering is correct — the bar sits above the nav. However, any element with `z-index` between 101 and 149 would appear above the navbar but below the announcement bar, which could create visual layering bugs if new overlays are introduced. Currently no such element exists, but note this for any future modal work.  
**Fix:** Not a current bug. Document for awareness.

---

### PDP — Add to Bag not reachable above fold on mobile

**Breakpoints affected:** 320–768px  
**Where:** [`frontend/app/(shop)/product/[id]/page.module.css:259`](frontend/app/(shop)/product/[id]/page.module.css#L259)  
**What breaks:** At ≤900px the layout collapses to a single column: gallery on top, then info column (product name, options, Add to Bag). On a 375px phone, the gallery images (aspect-ratio 4:5 portrait) would be approximately 375px × 469px = nearly full viewport. The Add to Bag button is below the fold by roughly one full screen height.  
**[VISUAL-CHECK-NEEDED]** — confirm in devtools at 375px whether the CTA is above or below the fold. If below, consider a sticky "Add to Bag" bar on mobile that appears after the user scrolls past the gallery:
```tsx
// A fixed bottom bar that appears on scroll (implementation example)
<div className={styles.mobileCta} aria-hidden="true">
  <button onClick={handleAdd}>{ctaLabel}</button>
</div>
```
This would be a feature addition — flag for decision before implementing.

---

### Account orders list — flex row at 320px

**Breakpoints affected:** 320px  
**Where:** [`frontend/app/(shop)/account/account.module.css:186`](frontend/app/(shop)/account/account.module.css#L186)  
**What breaks:** `.orderRow { display: flex; align-items: center; gap: 20px; }` contains four visible elements: `orderNum` (min-width: 80px), `orderDate` (flex: 1), `orderTotal`, and `orderStatus` badge. At 320px with 24px side padding = 272px content width. The min-width 80px + gap 60px (3 × 20px) + order total text + badge = approximately 270px+, which barely fits at 320px and likely causes the status badge to wrap or truncate.  
**[VISUAL-CHECK-NEEDED]** — test at 320px. If wrapping occurs:
```css
@media (max-width: 400px) {
  .orderRow { flex-wrap: wrap; gap: 8px; }
  .orderNum { min-width: auto; }
  .orderStatus { margin-left: auto; }
}
```

---

### Responsive summary table (public)

| ID | Component / File | Breakpoints | Type | Fix needed |
|----|-----------------|-------------|------|-----------|
| R1 | `globals.css:43` | 601–767px | Header offset | Yes — split padding-top rules |
| R2 | `Navbar.module.css:30` | 320–414px | Icon overflow | VISUAL-CHECK-NEEDED |
| R3 | `product/[id]/page.module.css:26` | 1024–1440px | Sticky clips under navbar | Yes — `top: 140px` |
| R4 | `ProductOptions.module.css:44` | all | Touch target (34px) | Yes — `min-height: 44px` |
| R5 | `ProductOptions.module.css:128` | 320–768px | Touch target (40px) | Yes — `44px` |
| R6 | `ProductOptions.module.css:187` | 320–768px | Touch target (26px) | Yes — `min-height: 44px` |
| R7 | `CartPanel.module.css:203` | 320–768px | Touch target (36px) | Yes — `44px` |
| R8 | `SideMenu.module.css:197` | all | Touch target (17px) | Yes — `min-height: 44px` |
| R9 | `account.module.css:447` | 320–768px | Touch target (36px) | Yes — `min-height: 44px` |
| R10 | z-index stack | all | Awareness note | No action needed now |
| R11 | PDP mobile CTA | 320–768px | Below fold | VISUAL-CHECK-NEEDED |
| R12 | `account.module.css:186` | 320px | Order row overflow | VISUAL-CHECK-NEEDED |
