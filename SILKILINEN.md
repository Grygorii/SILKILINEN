# SILKILINEN — Project State

Living document. Update this file every time a change is shipped to the SILKILINEN project.

Last updated: 28 May 2026 (Security audit verification pass — H1/H2/H3/M1/M5/L1 confirmed fixed in code; M6 partial. Stripe live mode confirmed: first real order €5.49 cleared 16 May 2026, payout €5.08 deposited 21 May 2026).

---

## What it is

E-commerce platform for a silk and linen brand, live at https://silkilinen.com. Owned by Гріша and his wife Sabreena. Brand origin is **Donegal, Ireland** (not Dublin — all customer-facing copy updated 14 May 2026). Built over roughly 12 working days using AI-augmented development (Claude in the chat for design and planning, Claude Code in VS Code for implementation).

**Brand copy layering (intentional):** The main announcement bar says "Ireland" (broad, internationally recognizable, welcoming surface). Product pages, emails, story copy, AI prompts, and footer all say "Donegal" (specific, evocative, the authentic depth of origin). This is deliberate — not a contradiction.

The site exists primarily to **escape Etsy's fee burden** (Etsy takes ~15-20% effective on each sale) and capture margin on existing Etsy product sales. The actual current hero product per the founders is silk panties at volume, not the dress/robe products currently most visible on the site. Strategy work that assumed luxury slip-dress positioning needs a reality-check pass against Etsy sales data before being acted on.

## Confirmed stack

- **Frontend:** Next.js on Vercel, deployed to `silkilinen.com` and `www.silkilinen.com`
- **Backend:** Express on Railway at `silkilinen-production.up.railway.app`
- **Database:** MongoDB Atlas (Mongoose models)
- **Image hosting:** Cloudinary, cloud name `dzybw5t5z`
- **Payments:** Stripe (LIVE mode as of 16 May 2026; first real order €5.49 cleared, payout €5.08 deposited 21 May 2026)
- **Email:** Resend (welcome emails, magic-link sign-in, transactional)
- **Auth:** Magic-link via email + Google OAuth for customers, JWT for admin
- **AI image gen:** Gemini integration with 5 model identities (Aoife, Charlotte, Sofia, Maya, Yuki) using v2 prompts
- **AI text (SEO):** DeepSeek (`deepseek-chat`) via OpenAI SDK; abstraction layer at `backend/services/aiText.js`; Gemini text removed

## Operational hardening shipped

- Node 20+ pinned via `package.json` engines + `backend/.nvmrc`
- `backend/railway.toml` forces Nixpacks builder (workaround for Railway Railpack BuildKit bug — remove once Railway fixes it)
- `app.set('trust proxy', 1)` in Express so rate-limiter reads real client IP behind Railway's reverse proxy
- Rate limiter is 5xx-aware (`requestWasSuccessful + skipFailedRequests`) — won't lock customers out during infrastructure outages
- Resend health check uses configuration validation (not live API call), compatible with the send-only API key
- Visit tracking with 90-day TTL, order attribution (customer session → order)
- Auth error responses are clean user-facing messages (no raw Mongoose/Node error text leaking to clients); infrastructure failures return structured 503
- Signed-token preview URLs for draft products (1hr JWT, noindex page, `PREVIEW MODE` banner)
- Visit tracking excludes admin sessions (pathname guard in `track.ts`)
- Geolocation on each visit (ip-api.com, 24hr in-memory cache, country + city + region stored on Visit documents)

## Customer-facing features live

Browse / product detail pages, cart with quantity adjustment and stock caps, wishlist, magic-link or Google OAuth sign-in, Stripe checkout, customer accounts. Newsletter signup with welcome email + SILK10 code. "Just sold" social-proof popup (public endpoint, no auth required). Free-shipping-over-€150-to-Ireland banner.

**Product page (as of 19 May 2026):** Multi-image gallery with desktop vertical thumbnail strip + main image; mobile touch-swipe with page dots. Video renders in gallery sequence (Cloudinary `so_0,f_jpg` poster). PRODUCT DETAILS accordion open by default. One-size products auto-select. Free shipping reminder below price. Heart: no white circle, charcoal fill, portal-fixed z-index. Contact button: speech bubble icon, response time line. Colour cubes instead of hex swatches (both on product page and shop grid). Footer: "14-day hassle-free returns". **Desktop:** right info panel is `position: sticky` + `align-self: start`; story sentence moved below Add to Bag so CTA is always above fold; no nested scroll on standard viewports (overflow-y:auto only kicks in as fallback on very short screens). **Mobile (≤900px):** single-column stack; persistent sticky bottom Add to Bag bar (`StickyBuyBar`) reads shared colour/size/qty state via `ProductSelectionContext` — tapping when no size selected scrolls to inline selectors; out-of-stock shows `OUT OF STOCK` state; iOS safe-area-inset-bottom applied.

## Admin tooling shipped

Mobile-first admin panel — sidebar on desktop, drawer + bottom-tabs on mobile. Nine sections: Dashboard, Products, Orders, Customers, Marketing, Content, Journal, Social, Finance, Settings.

**Finance tab at `/admin/finance`, `/admin/finance/expenses`, `/admin/finance/reports`** — full bookkeeping with auto-pulled Stripe revenue/fees/refunds, Marketing ad spend integration, COGS snapshotting from Product costing data, per-order profit calculation (revenue − Stripe fee − COGS − shipping cost − refunds), manual expense entry with category ledger, monthly P&L chart + table, margin analysis by product and acquisition source, anomaly flagging (orders without shipping cost, products without costing data, months with orders but zero expenses). Red/green honest reporting — no princess stories.

The Dashboard surfaces today/week/month revenue, top products, traffic sources, action items, a 30-day sparkline, with 5-minute auto-refresh. Zone 4 system-health monitors Mongo, Cloudinary, Resend, Stripe, and env vars on a 60-second poll.

Other admin pages:
- **AI Models page** — 5 identities (Aoife, Charlotte, Sofia, Maya, Yuki), unlocked, v2 prompts with separate `productShotPromptTemplate` and `lifestyleShotPromptTemplate` fields per model
- **Product CRUD** — "Add Product" creates an empty draft immediately and redirects straight to the full edit page (no intermediate form). Blocking validation modal on save (lists missing required fields by name, requires explicit "Got it" dismiss, scrolls to first invalid field after close); structured backend validation errors (save-level: name + price; publish-level: category, description ≥ 50 chars, images, variants)
- **Product duplicate** — clears SEO fields (`altTextTemplate`, `metaTitle`, `metaDescription`, `keywords`, `slug`) on duplicate so new product generates its own, no cross-contamination
- **Preview for drafts** — Preview button fetches a signed token, opens `/preview/[id]?token=...` in a new tab; page is noindex and shows a sticky "PREVIEW MODE — not yet published" banner
- **Photo slot picker** — named slots (HERO, FRONT, BACK, SIDE, DETAIL, LIFESTYLE) show a picker modal when clicked; admin can choose from existing unassigned uploads ("Use here") or upload new; filled slots show "↓ Gallery" (unslot without delete) + "Delete" actions
- **AI photo auto-routing** — approving a generated photo auto-places it into its matching named slot; if slot occupied, admin is prompted to replace or send to additional images
- **Dashboard geo** — "Top countries" and "Top cities" sections in WHAT'S WORKING zone; conversion math fixed (0% when no orders, — when no visitors, capped with warning log); conversion column hidden entirely until first order via `showConversion` flag; traffic sources, countries, and cities all show % of total sessions alongside conversion rates
- Order management

## Listed products as of 12 May 2026

- Aoife Terracotta Robe (first listed product) — AI-generated imagery, approved by Sabreena
- Existing Dalia / Bastet / Ciara / Rehab dress and robe products from earlier build phase
- **Silk panties** (the actual sales hero) — currently sold on Etsy, not yet migrated to silkilinen.com as primary

## Shipped 28 May 2026 — image-forward shop grid (locked spec)

Authoritative grid redesign — supersedes earlier image-forward draft from the same day. Tall uniform photos, one clean white line down the middle, white Lucide heart on each photo, tight caption with a small price. Locked specs below.

**Layout**
- 2 / 3 / 4 columns at mobile / tablet / desktop (≤768 / ≤1200 / default).
- `column-gap: 2px`, `row-gap: 0`, `background: #FFFFFF` on `.grid` → one pure-white vertical line per column-gap visible against the warm-cream page; **no** horizontal white lines between rows.
- Images run edge-to-edge of the container. No outer padding / frame.

**Image**
- Every cell is `aspect-ratio: 3 / 4`, `object-fit: cover`, `object-position: top center` (necklines and faces stay in frame; product hems may crop — acceptable per spec).
- 3:4 is enforced in **two** places as belt-and-braces: on `.cardImg` (caller-side) and inside `ProductImage` via a new `.wrapCard` rule that fires when `variant === 'card'`. Cell can never collapse shorter than its neighbour, even if a caller forgets the wrapper aspect-ratio.
- Existing `ProductImage` shimmer (loading) and cream "Image coming soon" (failed) states are preserved and now constrained to the 3:4 box.

**Heart (wishlist)**
- Lucide `Heart`, top-right of each photo at `top / right: var(--s-3)`.
- Default: white stroke, no fill. Favorited: filled white. Always layered with `filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))` so the white shape stays visible against both pale silk and dark photography.
- 44×44 hit area, `aria-label` reflects state, `aria-pressed={wished}` added.
- `heartPop` keyframe + `@media (hover: hover)` scale unchanged.

**Caption block** (small left inset, tight rhythm)
- `padding: var(--s-3) 0 var(--s-3) var(--s-2)` — ~8px left inset; ~12px top + bottom so the caption breathes inside the otherwise-zero row gap.
- **Name** — Cormorant Garamond, 15px, charcoal, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; full name carried in `title` attribute.
- **Material** — italic, 12px, muted, same single-line clamp + `min-height: 1.4em` so the row reserves a line even when `materialComposition` is empty. The JSX always renders the `<p>` so heights stay aligned across cards.
- **Price row** — flex space-between. Price left (12px, charcoal, `font-variant-numeric: tabular-nums`); bare Lucide `Plus` / `Check` right (44×44 hit area, ~18px visible icon, no border, no background, opacity + `scale(0.92)` on `:active`).

**Hover lift** — `transform: scale(1.03)` on the image only, behind `@media (hover: hover)`, over `--t-slow`. Reduced-motion disables it cleanly.

**Deliberate literals.** Two non-token values appear in the CSS by spec and are commented at the top of the file: `2px` (column-gap — no token below `--s-1 = 4px`) and `#FFFFFF` (the white line — design system canvas `--color-bg = #FAF8F4` is warm cream, deliberately not this). Everything else reads from `--s-1..7`, `--color-ink`, `--color-ink-muted`, `--color-bg`, `--stroke`, `--t-fast / --t-base / --t-slow`, `--ease`.

**Out of scope (left untouched):** PDP, cart drawer, checkout. Per-card colour swatches stay off the grid (colour selection lives on the PDP). Pre-existing dead CSS `.colours` / `.colourDot` left in place (not created by this change).

Files: `frontend/components/ProductGrid.{tsx,module.css}`, `frontend/components/products/ProductImage.{tsx,module.css}` (added `.wrapCard` + applied conditional class for `variant === 'card'`).

---

## Shipped 28 May 2026 — promo codes bulk archive UX

Make `/admin/promo-codes` actually usable for ongoing cleanup. New layout: four tabs (Active / Used / Archive / All) replace the old status chips, with the existing "All codes / Personal only / Broad only" filter and search box kept as secondary filters scoped to each tab. "Active" tab includes paused and draft codes; "Used" is `usageCount > 0` excluding archived; "Archive" is the new bucket; "All" is everything except archived.

- Backend: added `'archived'` to the `PromoCode.status` enum. Existing DELETE route now sets `status: 'archived'` (was `'expired'`). Existing `'expired'`-status codes left as-is — they appear under the "All" tab (which excludes only archived) — migration out of scope per spec.
- Backend: `POST /api/promo-codes/bulk` accepts `{ action, ids }` with action ∈ archive/restore/pause/resume (validated against `BULK_ACTIONS` allowlist matching the `PRODUCT_ALLOWED_FIELDS` pattern). Per-id status check (e.g. resume only succeeds if current status is paused). Response shape `{ succeeded, failed }` lets the UI surface partial-failure cleanly.
- Backend: `GET /api/promo-codes/export?ids=a,b,c` returns text/csv (code, type, value, minOrderValue, status, usageCount, maxUses, validUntil, createdAt, description). Mounted before `GET /:id` so the static path isn't shadowed by the id param.
- Both new routes go through `requireAuth` middleware.
- Frontend: checkbox column added to the table; master checkbox in the header has indeterminate state when some-but-not-all visible rows are selected. Row highlight on selection.
- Frontend: bottom-fixed action bar appears when ≥1 selected — shows "N selected", Archive (or Restore on Archive tab), Pause / Resume (on Active tab only, only enabled if ≥1 selected code matches the required current status), Export CSV, Clear (×). Destructive actions (Archive / Restore) open a confirmation modal reusing the existing `.overlay`/`.modal` CSS. Selection clears on tab change.
- Frontend: row-level "Delete" renamed to "Archive" (semantic rename — behavior unchanged, soft-archives in our DB and deletes the Stripe coupon).
- Selection state lives in `useState<Set<string>>` in the page (matches existing `/admin/products` bulk-select precedent; no Context, no URL state — Context would be overkill for two co-located consumers and URL state was rejected since ~30 IDs × 24 chars would bloat the URL and selection is ephemeral anyway).
- Caveat: restored codes whose Stripe coupon was deleted on archive may need re-syncing via the per-code detail page. Restore modal copy warns the user.

Files: `backend/models/PromoCode.js`, `backend/routes/promoCodes.js`, `frontend/app/admin/promo-codes/page.tsx`, `frontend/app/admin/promo-codes/page.module.css`.

---

## Shipped 19 May 2026 — preview page crash fix + preload warning

### Crash: `useProductSelection must be inside ProductSelectionProvider`

**Root cause:** The preview page at `/app/(shop)/preview/[id]/page.tsx` renders `<ProductOptions>`, which calls `useProductSelection()` at the top level. `useProductSelection()` throws if no `<ProductSelectionProvider>` is in the ancestor tree. The live PDP (`/app/(shop)/product/[id]/page.tsx`) wraps `ProductOptions` + `StickyBuyBar` inside `<ProductSelectionProvider>` — the preview page had neither.

**Fix:** Added `ProductSelectionProvider` and `StickyBuyBar` imports to the preview page. The product content is now wrapped in `<ProductSelectionProvider defaultColour={...} defaultSize={...}>`, matching the live PDP structure exactly (same default-colour/size initialisation logic, same `StickyBuyBar` for mobile parity, same `image` prop passed to `ProductOptions`).

### Preload warning: `<link rel="preload">` resource not used in time

**Root cause:** `layout.tsx` had a manual `<head>` block containing a `<link rel="stylesheet">` for Google Fonts. Next.js App Router auto-generates a `<link rel="preload" as="style">` for any `<link rel="stylesheet">` it finds in the root layout's `<head>`, producing an external-resource preload that the browser can't always consume within its expected window.

**Fix:** Removed the manual `<head>` block from `layout.tsx`. Moved the Google Fonts import to `globals.css` as an `@import url(...)` at the top of the file — Next.js doesn't instrument `@import` rules, so no spurious preload is generated. Font loading behaviour is unchanged.

**Files modified:** `frontend/app/(shop)/preview/[id]/page.tsx`, `frontend/app/layout.tsx`, `frontend/app/globals.css`

---

## Shipped 19 May 2026 — dashboard conversion rate fix

### Root cause

`Visit.convertedToOrder` (an ObjectId field on the Visit model intended to mark a visit's session as having converted to an order) was **never written anywhere in the backend**. The Stripe webhook (`checkoutV2.js`) read the last Visit for attribution info but never wrote back. The dashboard aggregation depended entirely on this field:

```js
hasOrder: { $max: { $cond: [{ $ne: ['$convertedToOrder', null] }, 1, 0] } }
```

Because the field was always null, `buyers` was always 0, making conversionPercent 0.0% for all sources. The 100.0% shown on the dashboard was caused by stale `convertedToOrder` values left from an older code version that incorrectly set the field (likely on all visits, not just the converting session's) — this made `buyers = visitors` for those sources, computing as 100%.

### Fix 1 — Write `convertedToOrder` in checkout webhook

In `checkoutV2.js`, after `Order.create(...)`, added:

```js
if (sessionId) {
  Visit.updateMany({ sessionId }, { convertedToOrder: order._id })
    .catch(err => console.error('[checkoutV2] visit attribution write failed:', err.message));
}
```

This marks all page views in the converting session so product-level conversion tracking (`bestConvertingProduct` aggregation) also works going forward.

### Fix 2 — Replace Visit.convertedToOrder with `$lookup` in source aggregation

The top-sources aggregation now joins sessions with the Orders collection via `browserSessionId` (stored on every order at creation time) instead of relying on the pre-written `convertedToOrder` field. This retroactively fixes historical data: any order that exists with a valid `browserSessionId` is counted correctly without needing a data migration.

```js
Visit.aggregate([
  { $match: { createdAt: { $gte: thirtyDaysAgo } } },
  { $sort: { createdAt: 1 } },
  { $group: { _id: '$sessionId', source: { $first: '$source' } } },
  { $lookup: {
    from: 'orders', let: { sid: '$_id' },
    pipeline: [
      { $match: { $expr: { $and: [
        { $eq: ['$browserSessionId', '$$sid'] },
        { $in: ['$status', PAID_STATUSES] },
      ]}}},
      { $limit: 1 },
    ],
    as: 'matchedOrders',
  }},
  { $group: {
    _id: '$source', visitors: { $sum: 1 },
    buyers: { $sum: { $cond: [{ $gt: [{ $size: '$matchedOrders' }, 0] }, 1, 0] } },
  }},
  ...
])
```

### Fix 3 — `calculateConversion` defensive cap

Removed the `buyers > visitors → return 100` branch (dead code with the new aggregation, since buyers ≤ visitors is now guaranteed). Replaced with `Math.min(buyers, visitors)` before dividing, so stale DB data can never display >100% even if encountered.

**Files modified:** `backend/routes/checkoutV2.js`, `backend/routes/adminDashboard.js`

---

## Shipped 19 May 2026 — abandoned cart recovery

### Bug fix — abandoned carts page "Failed to load"

Root cause: `GET /api/orders` accepted a `to` query parameter and appended `'T23:59:59.999Z'` to it unconditionally (intended for date-only strings from the date picker). The abandoned carts page passed a full ISO datetime string for `to` (to get a precise 2-hour cutoff), producing an invalid concatenation like `"2026-05-19T10:30:00.000ZT23:59:59.999Z"`. Mongoose threw a CastError when trying to serialize this, returning a 500 → frontend showed "Failed to load".

Fix: detect whether `to` already contains a time component (`to.includes('T')`) and skip the suffix append if so.

**Files modified:** `backend/routes/orders.js`

### Recovery email automation (3-email sequence)

**Order model** — added `recoveryEmails: [{ seq, sentAt }]` and `recoveryUnsubscribed: Boolean` fields.

**Email function** (`services/email.js`) — added `sendCartRecoveryEmail(order, seq)`:
- Email 1 (+4–5h): "You left something behind"
- Email 2 (+24–25h): "Still thinking it over?"
- Email 3 (+72–73h): "Last chance — your silk pieces are waiting"
- Each email shows the cart items, subtotal, and a "Shop now" link to the product page
- Includes RFC 8058 `List-Unsubscribe` header + one-click unsubscribe link

**Cart recovery service** (`services/cartRecovery.js`) — `processCartRecovery()` queries pending orders in each time window (4–5h, 24–25h, 72–73h), skips orders where that seq has already been sent or `recoveryUnsubscribed: true`, sends email, records the send on the Order document.

**Unsubscribe route** (`routes/cartRecovery.js`) — `GET /api/cart-recovery/unsubscribe?oid=<base64url-orderId>` — sets `recoveryUnsubscribed: true`, renders a branded confirmation page.

**Cron** — `server.js` starts a `setInterval` after server boot (5-minute delay to allow DB connection) that calls `processCartRecovery()` every hour.

**Required env vars** (both already exist for other features):
- `RESEND_API_KEY` — email sending
- `BACKEND_URL` (default: `https://silkilinen-production.up.railway.app`) — unsubscribe link base URL
- `FRONTEND_URL` (default: `https://silkilinen.com`) — shop/product links in email

**Files modified/created:** `backend/models/Order.js`, `backend/services/email.js`, `backend/services/cartRecovery.js` (new), `backend/routes/cartRecovery.js` (new), `backend/server.js`

Also fixed: `AdminLayout active="marketing"` prop missing from abandoned-carts page (`frontend/app/admin/marketing/abandoned-carts/page.tsx`)

---

## Shipped 19 May 2026 — admin panel UX fixes

### P1.1 — Column header overflow fix (Products + Orders tables)

Both admin tables use `table-layout: fixed` with `white-space: nowrap` on `<th>` cells, but lacked `overflow: hidden` — header text could visually bleed into adjacent columns.

- Added `overflow: hidden` to `.table th` in `frontend/app/admin/products/page.module.css`
- Added `overflow: hidden` to `.table th` in `frontend/app/admin/orders/page.module.css`

**Files modified:** `frontend/app/admin/products/page.module.css`, `frontend/app/admin/orders/page.module.css`

### P1.2 — Publish prevention validation error display

Backend already validated name + variants + description ≥ 50 chars + images + category before allowing `status = 'active'` in `quick-update`. Frontend `InlineStatusEdit` was showing raw "ValidationError" string. Fixed to show human-readable list of missing fields: `"Cannot publish — missing: Description, Variants"`.

**Manual action still needed:** Delete junk product "kjxzcj" (Draft, no variants, no description) via the admin Products page.

**Files modified:** `frontend/app/admin/products/page.tsx`

### P1.3 — P&L chart: label contrast + empty state

- `.plLabel` (month names on bar chart) changed from `color: #aaa` (2.3:1 contrast) to `color: #666` (5.7:1, passes WCAG AA)
- Added `allZero` check (`monthlyPL.every(m => m.revenue === 0 && m.orderCount === 0)`). When all months have zero revenue, the chart section is replaced with "No revenue yet — P&L will appear once orders come in." instead of 12 bars of "+€0"

**Files modified:** `frontend/app/admin/finance/reports/page.module.css`, `frontend/app/admin/finance/reports/page.tsx`

### P2.1 — Dashboard mobile reflow (Zone3Working)

Zone3Working "What's Working" section used a hardcoded inline style `gridTemplateColumns: '1fr 1fr'` that CSS media queries couldn't override.

- Created `Zone3Working.module.css` with `.grid { display: grid; grid-template-columns: 1fr 1fr; }` + `@media (max-width: 1024px) { .grid { grid-template-columns: 1fr; } }`
- Replaced inline style in `Zone3Working.tsx` with the CSS class

**Files modified/created:** `frontend/app/admin/_components/dashboard/Zone3Working.tsx`, `frontend/app/admin/_components/dashboard/Zone3Working.module.css` (new)

### P2.2 — Mobile card layout (Orders + Products)

Both admin tables now have a parallel card layout at ≤768px (table is hidden, cards shown).

**Orders cards:** Each order is a tappable card showing status badge, date, total, customer name/email, and ship-to city + item count. Tapping expands the same full detail (customer info, shipping address, items sub-table, "View full order" link) as the desktop table row. Uses the same `expandedId` state — no duplication of logic.

**Products cards:** Each product is a card showing thumbnail (or no-image warning icon), product name (link to edit page), status badge, price, stock badge, issue pills, and Edit/Delete actions. Bulk selection and inline price/status editing are desktop-only (edit page always available on mobile).

**Files modified:** `frontend/app/admin/orders/page.module.css`, `frontend/app/admin/orders/page.tsx`, `frontend/app/admin/products/page.module.css`, `frontend/app/admin/products/page.tsx`

### ProductGallery — useEffect import fix

`useEffect` was called in `ProductGallery.tsx` (added in previous session) but was missing from the React import. Added to the import statement.

**Files modified:** `components/ProductGallery.tsx`

---

## Shipped 19 May 2026 — cart swipe + image placeholders + account section refinement

### Part 1 — Cart drawer swipe-right-to-close

Same pattern as the hamburger swipe-to-close (already shipped), mirrored for a right-side drawer. Added native `addEventListener` touch handlers (with `passive: false` on `touchmove`) to `CartPanel.tsx`. Horizontal vs vertical direction determined on first >4px movement. Swipe right > 30% of panel width or velocity > 0.5 px/ms closes; `getBoundingClientRect()` flush re-enables the CSS transition before the close animation. Partial swipe snaps back.

Also replaced the `overflow: hidden` body lock (ignored by iOS Safari) with the `position: fixed` + saved-scrollY approach. Added `overscroll-behavior: contain` to `.items`.

**Files modified:** `frontend/components/CartPanel.tsx`, `frontend/components/CartPanel.module.css`

### Part 2 — Account section refinement (SideMenu)

Revised from the "single row" design shipped earlier. Logged-in state now shows:
- **Hello, [Name] →** — navigates to `/account`
- **Wishlist** (Heart icon, count badge if non-zero) — navigates to `/wishlist`
- **Orders** (Package icon, chevron) — navigates to `/account/orders`
- **Sign out** (LogOut icon, muted text) — calls `signOut()`, closes drawer, redirects to `/`

Logged-out state remains a single "Sign in" row.

Re-added `useWishlist`, `signOut` from `useCustomer`, and lucide icons `Heart`, `Package`, `LogOut`.

New CSS classes: `.accountItem`, `.accountBadge`, `.accountSignOut`.

**Files modified:** `frontend/components/SideMenu.tsx`, `frontend/components/SideMenu.module.css`

### Part 3 — Branded image placeholders

**`ProductImage` component** (`frontend/components/products/ProductImage.tsx`) fully rewritten with a three-state machine (`loading` → `loaded` | `failed`):
- **Loading**: shimmer skeleton (`linear-gradient` animated with `background-position`, same pattern as the admin table skeletons)
- **Failed / missing**: cream background + "Image coming soon" text (text suppressed at `thumbnail` and `cart` sizes where it would be illegible)
- **Loaded**: image fades in via `opacity: 0 → 1`

New CSS module: `frontend/components/products/ProductImage.module.css`.

**CartPanel** now uses `<ProductImage wrapClassName={styles.itemImg} ... />` instead of the bare `<img>` pattern. Cart thumbnails show the shimmer skeleton while loading and a clean cream box on failure — no browser broken-image icon. Removed unused `.itemImgEl` from CartPanel CSS.

**ProductGrid** shows `<span className={styles.imgMissing}>Image coming soon</span>` inside `.cardImg` when `heroUrl` is null (no valid image). The `.cardImg` container already has `background: var(--cream)` so the cream box shows for failed loads via the existing `onError` handler.

**Files modified/created:** `frontend/components/products/ProductImage.tsx`, `frontend/components/products/ProductImage.module.css` (new), `frontend/components/CartPanel.tsx`, `frontend/components/CartPanel.module.css`, `frontend/components/ProductGrid.tsx`, `frontend/components/ProductGrid.module.css`

---

## Shipped 19 May 2026 — hamburger drawer UX fixes

Three fixes to `SideMenu.tsx` + `SideMenu.module.css`. No changes to Navbar.

### Body scroll lock (iOS Safari fix)

Previous implementation used `document.body.style.overflow = 'hidden'`, which iOS Safari ignores during touch events. Replaced with the position:fixed approach: on open, saves `window.scrollY`, sets `body.position = 'fixed'`, `body.top = -${scrollY}px`, `body.width = '100%'`. Cleanup restores all properties and calls `window.scrollTo(0, scrollY)` to restore scroll position.

Added `overscroll-behavior: contain` to `.panel` in CSS — prevents scroll chaining to body when the user scrolls to the top/bottom of the drawer content and keeps scrolling.

### Account section redesign

Replaced the 5-item logged-in stack (greeting, My Account, Orders, Wishlist, Sign out) and 2-item logged-out stack (Sign in, Create account) with a single row in both states:
- **Logged in:** "Hello, [First Name] →" — taps to `/account` (the full account dashboard has all sub-items)
- **Logged out:** "Sign in" — taps to `/account/sign-in`

Removed `useWishlist` import and `signOut` from `useCustomer` destructure — both were only used by the removed items. Removed CSS classes `.accountGreeting`, `.accountLink`, `.accountSignOut`. Added `.accountRow` (matches category link typography: 12px, 2.5px letter-spacing, `justify-content: space-between` for the chevron).

**Files modified:** `frontend/components/SideMenu.tsx`, `frontend/components/SideMenu.module.css`

### Swipe-left to close

Native `addEventListener` (not React synthetic events) on the panel element so `touchmove` can be added with `{ passive: false }` — required to call `e.preventDefault()` and block body scroll during a horizontal swipe.

Gesture logic:
- `touchstart`: records start position + timestamp
- `touchmove`: on first >4px movement, determines direction by comparing `|dx| > |dy|` AND `dx < 0`. Horizontal: sets `transition: none` and `transform: translateX(dx)` directly on the DOM (no React state). Vertical: ignored (drawer scroll proceeds normally).
- `touchend`: calculates velocity (px/ms). Closes if dragged > 30% of panel width OR velocity < −0.5 px/ms. On close: clears `transition`, forces style flush via `getBoundingClientRect()`, animates `transform: translateX(-100%)`, waits 290ms, then clears inline style and calls `onClose()`. On snap-back: same flush + `translateX(0)`, inline style cleared after 290ms.

Effect re-runs on `[isOpen, onClose]` — adds listeners when open, cleans up when closed or component unmounts.

Part 0 clarification: no "bag in hamburger" — bag icon is in the Navbar header (Interpretation A), drawer is correct as-is.

**Files modified:** `frontend/components/SideMenu.tsx`, `frontend/components/SideMenu.module.css`

---

## Shipped 19 May 2026 — product image pipeline lockdown

Root cause of repeated broken-image bugs: Gemini chat session URLs (e.g. `https://gemini.google.com/app/...`) were pasted into image fields instead of saving the generated image as a file and uploading it. These URLs return HTML, not image data, so every `<img>` using them showed a broken-image icon.

### Shared utilities — `frontend/lib/imageUtils.ts` (new)

Two exported functions used across the frontend:
- `isValidImageUrl(url)` — returns `false` for null/undefined, non-HTTP strings, and any URL matching `gemini.google.com`
- `cloudinaryUrl(url, width)` — applies `w_{width},c_fill,f_auto,q_auto` Cloudinary transform

### ProductGallery — proactive filter

Added `isValidImageUrl` import. The `.filter()` that builds the sorted image list now uses `isValidImageUrl(img.url)` instead of the bare `img.url` truthiness check. Gemini URLs are stripped before any network request is attempted, so working images are no longer hidden by broken siblings.

**Files modified:** `frontend/components/ProductGallery.tsx`

### ProductGrid — proactive filter + onError

`validImages` array now filters with `isValidImageUrl` before resolving `primaryImg` / `secondImg`. Legacy `product.image` string also validated before use. Both `<img>` tags have `onError` to hide if the URL passes validation but the actual fetch fails.

**Files modified:** `frontend/components/ProductGrid.tsx`

### CartPanel, NewArrivals, RecentlyViewed

- `CartPanel`: added `onError` to the line-item thumbnail `<img>`
- `NewArrivals`: `product.image` validated with `isValidImageUrl` before rendering (server component — no `onError` possible)
- `RecentlyViewed`: `isValidImageUrl` check + `onError` on the thumbnail img

**Files modified:** `frontend/components/CartPanel.tsx`, `frontend/components/NewArrivals.tsx`, `frontend/components/RecentlyViewed.tsx`

### ProductImage component — `frontend/components/products/ProductImage.tsx` (new)

Reusable client component for future surfaces. Accepts either an `images[]` array (resolves primary/order) or a direct `src` string. Validates with `isValidImageUrl`, applies Cloudinary width transform for the requested variant (`card` 400px, `thumbnail` 160px, `cart` 200px), returns `null` for missing/invalid URLs, and hides on `onError`.

### Admin lockdown verification

Confirmed: the product admin editor has no URL paste text input — all image inputs are file-upload-only. The backend `/api/admin/products/:id/images/url` endpoint (used by the AI Photoshoot approval flow) already rejects non-Cloudinary URLs server-side. Journal editor also uses file inputs only. No UI changes required.

### Audit script — `backend/scripts/auditBrokenImages.js` (new)

Run: `node scripts/auditBrokenImages.js`

Connects to MongoDB (reads `MONGODB_URI` from `.env`), scans all Products and JournalArticles, outputs a line per broken reference (Gemini URL, non-HTTP string, or empty). Гріша runs this to get a list of every product/article needing a real image re-upload via admin.

**Manual action still needed:** Run the audit script, then re-upload broken images for any affected products (known: boxer short product has 3 broken Gemini URLs in FRONT, BACK, SIDE slots).

**Files created:** `backend/scripts/auditBrokenImages.js`, `frontend/lib/imageUtils.ts`, `frontend/components/products/ProductImage.tsx`

---

## Shipped 19 May 2026 — Cloudinary upload pipeline verification

### Findings

The upload pipeline in `adminProducts.js` was already correct: `uploadBuffer` wraps `upload_stream` in a Promise and is properly `await`-ed before the DB write; `result.secure_url` (not a pre-constructed URL) is stored. Root cause of any 404 Cloudinary URLs in the DB is most likely direct deletion via the Cloudinary dashboard after upload.

### Audit script extended with `--verify` flag

`backend/scripts/auditBrokenImages.js` now supports:

```
node scripts/auditBrokenImages.js            # pattern-only (Gemini URLs, non-HTTP, empty) — fast
node scripts/auditBrokenImages.js --verify   # also HEAD-checks every Cloudinary URL — slower
```

In `--verify` mode the script makes an HTTPS `HEAD` request (10s timeout) to each `res.cloudinary.com` URL that passes the pattern check. Any URL returning 4xx/5xx (or timeout) is logged as `PRODUCT 404` or `JOURNAL HERO 404`. Uses Node's built-in `https` module — no extra dependencies.

### Backend error propagation improved

The catch block for the image upload route now detects Cloudinary SDK errors (which carry `err.http_code`) and returns a specific 502 with the actual error message instead of a generic 500 "Internal server error":

```js
if (err.http_code) {
  return res.status(502).json({ error: `Upload failed — ${err.message}` });
}
```

This surfaces the real failure (e.g. "Invalid API key", "Resource not found") to the admin UI toast instead of a blank error.

**Files modified:** `backend/scripts/auditBrokenImages.js`, `backend/routes/adminProducts.js`

---

## Shipped 19 May 2026 — mobile header simplification

Search and Account icons removed from mobile header (≤767px). Wishlist and Bag (both with count badges) remain visible in the mobile header.

**Navbar changes (`Navbar.tsx` + `Navbar.module.css`):**
- Search button and Account dropdown wrap both get an additional `styles.desktopOnly` class
- `@media (max-width: 767px) { .desktopOnly { display: none; } }` hides them at mobile breakpoint
- Desktop: all four icons (Search, Wishlist, Account, Bag) remain visible — no change

**SideMenu changes (`SideMenu.tsx` + `SideMenu.module.css`):**
- Full Account section added to the hamburger drawer, above the footer
- Logged-in variant: "Signed in as [name]" greeting, My Account, Orders, Wishlist (with count), Sign out button
- Logged-out variant: Sign in, Create account
- Old minimal footerRow (single account link + wishlist link) removed
- Unused `Heart` and `User` lucide imports removed from SideMenu

**Files modified:** `frontend/components/Navbar.tsx`, `frontend/components/Navbar.module.css`, `frontend/components/SideMenu.tsx`, `frontend/components/SideMenu.module.css`

---

## Shipped 19 May 2026 — session 2

### Cookie banner + hero CTA visual hierarchy

**Cookie banner (GDPR-compliant):**
- Banner now shows two stacked buttons: **ACCEPT ALL** (filled, prominent) + **COOKIE SETTINGS** (outlined, neutral). No "Reject" dark pattern on the banner itself.
- "Cookie Settings" opens a modal with per-category toggles (Necessary always-on, Functional, Analytics, Marketing) and two equal-weight action buttons: **REJECT ALL** + **SAVE PREFERENCES**.
- User can reject all cookies in 2 clicks (banner → modal → reject all) — satisfies GDPR/Irish DPC requirement.
- Consent state extended to `'accepted' | 'rejected' | 'customised' | null`. Per-category prefs stored as JSON in `silkilinen:cookiePrefs` localStorage key.
- `AnalyticsLoader` (GA4, Clarity, Vercel Analytics), `MetaPixel`, and `PinterestTag` now each check `consent === 'customised' && preferences?.analytics/marketing` so per-category gating works correctly.
- `CookiePreferencesLink` (footer) now opens settings modal directly instead of re-showing the banner.

**Hero CTA:** `SHOP THE COLLECTION` button changed from outlined (transparent) to solid filled (`var(--dark)` background, `var(--warm-white)` text) — visible against any hero photo regardless of background tone.

**Hero headline scrim:** Subtle gradient overlay added via `::before` pseudo-element. Desktop: rises from bottom-left (55% wide, 70% tall, 0.28 opacity). Mobile: full-width bottom-to-top gradient (0.3 opacity). Lifts headline legibility over busy photos without visually competing with the photo.

**Files modified/created:** `context/CookieConsentContext.tsx`, `components/CookieConsentBanner.tsx`, `components/CookieConsentBanner.module.css`, `components/CookieSettingsModal.tsx` (new), `components/CookieSettingsModal.module.css` (new), `components/CookiePreferencesLink.tsx`, `components/AnalyticsLoader.tsx`, `components/MetaPixel.tsx`, `components/PinterestTag.tsx`, `app/(shop)/page.module.css`

---

## Shipped 19 May 2026

### Header polish (sticky container + icon consistency)

- **SiteHeader wrapper** (`components/SiteHeader.tsx` + `SiteHeader.module.css`) — single `position: fixed` container wraps both `AnnouncementBar` and `Navbar`. Mobile hide-on-scroll transforms the entire block via `data-scrolled-down` attribute, eliminating the empty gap left by the previous approach (transforming only the bar).
- **Icon consistency** — all header icons are now uniform outline `lucide-react` strokes (`strokeWidth={1.5}`). `Heart` no longer fills when wishlist has items (always outline). Logged-in state shows `<User>` icon (not filled avatar circle with initial). Signed-in greeting ("Hi, Firstname") moves inside the account dropdown as first item. `AnnouncementBar` and `Navbar` reverted to non-fixed positioning (SiteHeader owns it).

**Files modified/created:** `SiteHeader.tsx`, `SiteHeader.module.css`, `components/Navbar.tsx`, `components/Navbar.module.css`, `components/AnnouncementBar.tsx`, `components/AnnouncementBar.module.css`, `app/(shop)/layout.tsx`

### Product gallery — broken image URLs fix

Root cause: the `POST /api/admin/products/:id/images/url` endpoint accepted any URL without validation. Non-Cloudinary URLs (e.g. expired Gemini chat URLs or other temporary URLs) could be stored in `product.images[].url`. The gallery would show the correct number of dots (data present) but all images rendered as broken icons.

- **Backend validation (`backend/routes/adminProducts.js`):** Added `url.includes('res.cloudinary.com')` check to the `/images/url` endpoint. Non-Cloudinary URLs now return HTTP 400. This closes the data-entry path that allowed bad URLs in. All legitimate callers (AI Photoshoot approval, finalize) already produce Cloudinary `secure_url` values.
- **Defensive gallery rendering (`components/ProductGallery.tsx`):** Added `failedUrls` state (Set). Images with empty `url` or a URL that triggers `onError` are removed from the `items[]` array and excluded from the dots count. `onError` applied to hero image, lightbox image, and thumbnail strip images. Added `useEffect` to clamp `current` index to valid range when items shrink. This ensures a product with partially-bad image data degrades gracefully rather than showing a wall of broken icons.

**Data fix still needed:** Any product already in the database with broken image URLs needs manual cleanup in the admin panel — delete the broken images from the product's image list and re-upload proper Cloudinary-hosted photos.

**Files modified:** `backend/routes/adminProducts.js`, `components/ProductGallery.tsx`

---

### Button states + interaction polish (site-wide)

- **Tap highlight** — `-webkit-tap-highlight-color: transparent` applied globally to `a, button, [role="button"], input[type="button/submit/reset"]`. Replaces blue flash with `opacity: 0.75` on `:active` (both `a` and `button`).
- **Focus ring** — `*:focus-visible { outline: 2px solid var(--dark); outline-offset: 3px; border-radius: 2px }` globally. Visible during keyboard navigation only. `*:focus:not(:focus-visible) { outline: none }` removes default outline for mouse/touch.
- **Size selector contrast** — `.sizeBtn` border changed from `var(--border)` (#e8e2d6, barely visible on warm-white bg) to `var(--dark)` (#2a2218). Same for `.colourCube`. Hover state border-color change removed (now redundant — hover shows background shift to cream only). `.sizeBtn:disabled` added (opacity 0.35, cursor not-allowed, line-through text).
- **Chat widget overlap** — `ContactWidget` on ≤900px (matches `StickyBuyBar` breakpoint) now positioned at `bottom: calc(72px + env(safe-area-inset-bottom) + 12px)` — sits above the sticky buy bar. Replaced the old `@media (max-width: 480px)` bottom override.

**Files modified:** `app/globals.css`, `components/ProductOptions.module.css`, `components/ContactWidget.module.css`

### Related products + recently viewed — missing images fix

Root cause: both `CrossSell` and `RecentlyViewed` had hardcoded `<div className={styles.img} />` — a styled empty div, never an `<img>` tag. The image data existed in the API response but was never rendered.

- `CrossSell`: updated `Product` type to include `images[]`; renders `<img>` inside the div using defensive accessor (`isPrimary` → first → `image` fallback). CSS: `overflow: hidden` + `.imgTag { object-fit: cover }`.
- `RecentlyViewed`: `ViewedProduct` type extended with `image?`; validation fetch now extracts the primary/first image from the full product response and attaches it to the validated entry; `<img>` rendered. `trackProductView` extended to accept optional `image` arg so the localStorage entry carries the image on first write.
- `ProductViewTracker`: passes `image={galleryImages[0]?.url}` from the product page.

**Files modified:** `components/CrossSell.tsx`, `components/CrossSell.module.css`, `components/RecentlyViewed.tsx`, `components/RecentlyViewed.module.css`, `components/ProductViewTracker.tsx`, `app/(shop)/product/[id]/page.tsx`

### Product page — sticky panel + mobile sticky buy bar

Root cause: info column had `overflow-y: auto` and story sentence placed above price/selectors, pushing Add to Bag below the fold of the nested scroll. Customers couldn't find the buy button.

- **Desktop:** `align-self: start` added to `.infoCol` (critical for sticky in CSS Grid); `top` corrected to `136px` (120px header + 16px breathing); story sentence moved below `ProductOptions` so Add to Bag is always above fold on standard viewports.
- **Mobile:** `StickyBuyBar` component pinned to `bottom: 0` (hidden on desktop via `@media (min-width: 901px)`). Shows product name, price, Add to Bag. Shares colour/size/qty state with inline `ProductOptions` via `ProductSelectionContext`. Tapping when size/colour unselected scrolls to inline selectors. Out-of-stock state respected. iOS `env(safe-area-inset-bottom)` applied.
- **State sharing:** `ProductSelectionContext.tsx` (new) provides `selectedColour`, `selectedSize`, `qty` to both `ProductOptions` and `StickyBuyBar`. `ProductSelectionProvider` wraps both components in `page.tsx`.

**Files modified/created:** `app/(shop)/product/[id]/page.tsx`, `app/(shop)/product/[id]/page.module.css`, `components/ProductOptions.tsx`, `components/ProductSelectionContext.tsx` (new), `components/StickyBuyBar.tsx` (new), `components/StickyBuyBar.module.css` (new)

---

## Shipped 16 May 2026 — hotfix bundle #7–11

**#7 — Customer email capture + order confirmation:**
- Required email input added to `/checkout` above the AddressElement (pre-filled for logged-in customers via CustomerContext)
- `create-intent`: passes `email` as `receipt_email` and `metadata.customerEmail` to Stripe PaymentIntent
- `update-intent`: also accepts `email`, updates `receipt_email` + `metadata.customerEmail`
- `PaymentForm.handleSubmit`: calls `update-intent` with the typed email before `stripe.confirmPayment` — ensures webhook always gets the email even if email was entered after PI creation
- Webhook reads `intent.receipt_email || intent.metadata.customerEmail`; persists as `order.customerEmail`
- `sendOrderConfirmation` already guarded by `order.customerEmail` — now fires on every paid order

**#8 — Fix double-counted shipping in totals:**
- Admin order detail page: was showing `order.total` as "Subtotal" and then adding `shippingCost` again for "Total". Fixed: "Subtotal" = `order.subtotal`, "Total" = `order.total` (Stripe PI amount, already includes shipping). Discount row added.
- `email.js buildHtml`: was computing `grandTotal = itemsSubtotal + shippingCost` ignoring discount. Fixed: `grandTotal = order.total ?? (itemsSubtotal - discountAmount + shippingCost)`. Discount row added to email template.
- `sendAdminOrderNotification`: subject line now uses `order.total` directly.

**#9 — Status-change emails:** Already wired in `orders.js` (`STATUS_EMAIL_FNS` map + `order.customerEmail` guard). Will fire automatically now that #7 persists email on orders.

**#10 — Admin order detail polish:**
- Right sidebar (`rightCol`) is now `position: sticky` on desktop with `max-height: calc(100vh - 48px)` + scroll — status panel stays visible while scrolling left column
- Discount row (`totalRowDiscount` in green) added to items totals block

**#11 — Dashboard stats bugs:**
- Bug 1 (100% conversion): `calculateConversion` now returns `null` (shown as `—`) when a source has fewer than 5 sessions — too sparse to be meaningful
- Bug 2 (>100% source %): Sources aggregation now groups by `sessionId` first (picking `$first` source per session), then groups by source — guarantees source percentages sum to ≤100%
- Bug 3 (<100% country/city %): Country/city `percentOfTraffic` now uses `totalGeoVisitors` (sessions with geo data) as denominator instead of all sessions — percentages now correctly sum to 100% within geolocated sessions

**Files modified:**
- `backend/routes/checkoutV2.js`
- `backend/routes/adminDashboard.js`
- `backend/services/email.js`
- `frontend/app/(shop)/checkout/page.tsx`
- `frontend/app/(shop)/checkout/page.module.css`
- `frontend/app/admin/orders/[id]/page.tsx`
- `frontend/app/admin/orders/[id]/page.module.css`

---

## Shipped 16 May 2026 — late session (overnight hotfix bundle)

- **#1 Shipping address collection** — `AddressElement` (mode=shipping) on `/checkout`; Stripe auto-attaches address to PaymentIntent on `confirmPayment`; webhook reads `intent.shipping` → persisted to `Order.shippingAddress` (name, phone, line1, line2, city, state, postalCode, country). Order model extended with `name` and `phone` on `shippingAddress`.
- **#1 update-intent endpoint** — `POST /api/v2/checkout/update-intent` updates existing PI amount (country/discount change) without new `clientSecret`, so AddressElement fields never reset mid-form.
- **#2 PaymentElement tabs layout** — `options={{ layout: 'tabs' }}` on PaymentElement; card/Link/Klarna render as tabs not accordion.
- **#3 Duplicate newsletter popup removed** — deleted `NewsletterPopup.tsx` (JOIN THE LIST) from root layout; `EmailCapturePopup` (PURE SILK, PURE COMFORT) is the single popup, with scroll/exit-intent triggers and 30-day suppression.
- **#4 Shop grid heart** — removed white circle/border; now matches product page style (no background, drop-shadow glow).
- **#5 Product video** — `autoPlay muted loop playsInline`; `object-fit: cover` (no letterboxing); no controls overlay.
- **#6 Heart tap highlight** — `-webkit-tap-highlight-color: transparent` on heart buttons in both ProductGrid and ProductGallery; eliminates blue rectangle flash on tap.

**Known bugs added to tracking:**
- `middleware.ts` → rename to `proxy.ts` for Next.js 16 (deprecation warning, not blocking)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` exists redundantly on Railway — only needed on Vercel; delete from Railway when convenient

## Shipped 16 May 2026

### Section B — Collections system
- `backend/models/Collection.js` — full Collection schema (name, slug, description, heroImage, isFeatured, featuredOrder, displayOrder, status, metaTitle, metaDescription)
- `backend/routes/adminCollections.js` — admin CRUD + product assignment + bulk reorder. All routes require admin auth
- `backend/routes/collections.js` — public endpoints: GET all active, GET featured, GET /:slug with products
- Wired into `backend/server.js` at `/api/admin/collections` and `/api/collections`
- `backend/scripts/seedCollections.js` — seeds 5 initial collections (New Arrivals, Sleepwear, Intimates, Donegal Motif Series, Editor's Picks)
- `Product` model extended with `collections: [ObjectId ref Collection]`, `colorName`, `colorHex`, `colorVariants`
- Admin UI: `/admin/collections` list page + `/admin/collections/[id]` edit/create page (with product assignment search)
- Storefront: `/collections/[slug]` page with optional hero image, description, product grid
- `FeaturedCollections` server component on homepage (between NewArrivals and CategoryTiles) — shows featured active collections as tiles

### Section A — Parallel commerce engine (Payment Intents)
- `backend/services/shipping.js` — rate tiers: IE €4.99/€150 free, GB/IM/JE/GG €14.99/€250 free (Derry), EU €9.99/€200 free, US/CA/AU €14.99/€300 free, worldwide €19.99/€400 free
- `backend/services/discounts.js` — validate + redeem PromoCode; returns discountAmount
- `backend/services/tax.js` — stub returning `shouldDisplay: false` (sole trader below Irish VAT threshold — no VAT shown anywhere)
- `backend/models/Cart.js` — persistent cart keyed by sessionId, 7-day TTL via MongoDB TTL index
- `backend/routes/cart.js` — GET, POST (add/increment), PATCH (qty), DELETE items; POST/DELETE discount; PATCH country
- `backend/routes/checkoutV2.js` — `checkoutRouter` at `/api/v2/checkout/create-intent`: validates items, creates Stripe PaymentIntent with items + discount + shipping in metadata; `webhookRouter` at `/api/webhook`: handles `payment_intent.succeeded`, creates Order with orderNumber
- **Commerce cutover complete (16 May 2026):** CartPanel "Checkout" button navigates to `/checkout`; old `checkout.js` + `webhook.js` deleted; webhook consolidated at `/api/webhook` using `STRIPE_WEBHOOK_SECRET`
- `Order` model extended: `stripePaymentIntentId`, `stripeChargeId`, `orderNumber`, `subtotal`, `discountCode`, `discountAmount`, `refunds[]`, `partially_refunded` status
- Refund endpoint: `POST /api/orders/:id/refund` — creates Stripe refund, updates `refunds[]`, sets status to `refunded` or `partially_refunded`
- Frontend `/checkout` page — Stripe Elements embedded card form; country selector for shipping preview; discount code input; order summary with live totals. `@stripe/react-stripe-js` + `@stripe/stripe-js` installed
- Admin order detail page — refund card (amount + reason input, confirm dialog, Stripe refund, status update); extended type with refunds[], orderNumber, stripePaymentIntentId; `partially_refunded` added to status list

### Section C — Colour UX
- Colour swatches removed from shop product cards (`ProductGrid.tsx`)
- Colour cubes (text, not hex circles) on product page (`ProductOptions.tsx`)
- `colorVariants` cross-product linking on product page (`page.tsx`) — server-side, no client JS

### Section D — Shipping page
- Full rewrite of `/shipping` page: 5-row table (Ireland, UK, EU, US/CA/AU, Worldwide), Derry advantage for UK, customs section, no duplicate returns content

### Section E — Policy + footer
- Privacy Policy: effective date 1 May 2026, last updated 16 May 2026; cookies section: essential only, no analytics cookies, no banner yet
- Terms: effective date 1 May 2026, last updated 16 May 2026; governing law Republic of Ireland
- Footer trust badge: "14-day hassle-free returns"

## Vercel build fix — 16 May 2026

- `frontend/app/admin/promo-codes/[id]/page.tsx` — `editForm.status` typed as `string | null` (from `PromoCode.status`); React's `<select value>` prop doesn't accept `null`. Fixed: `value={editForm.status || ''}` — same pattern already used for `redemptionType` in the same file.

## Known bugs / minor (updated 16 May 2026)

- `middleware.ts` → rename to `proxy.ts` for Next.js 16 (deprecation warning, not blocking)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set on Railway — only needed on Vercel; delete from Railway when convenient
- Microsoft Clarity tracker firing — origin unknown, investigate before enabling any paid-ads pixels
- Mongoose duplicate-index warnings on `Product.slug`, `Customer.email`, `Customer.googleId` — cosmetic, not affecting functionality
- `finalize()` in AiPhotoshoot does not auto-route to slots — only individual `approvePhoto()` does

## Shipped 16 May 2026 — Marketing Command Center (#12 + full marketing layer)

**#12 — Remove "Just Sold" social-proof popup:**
- `<JustSoldPopup />` removed from `frontend/app/(shop)/layout.tsx` — doesn't fit editorial-luxury positioning
- Backend `/api/just-sold` endpoint preserved (used for data, not rendered in storefront)

**GDPR consent system:**
- `frontend/context/CookieConsentContext.tsx` — `CookieConsentProvider` + `useCookieConsent()` hook; localStorage key `silkilinen:cookieConsent`; migrates from old `silkilinen_cookie_consent` key (legacy `all` → `accepted`, `essential` → `rejected`)
- `frontend/components/CookieConsentBanner.tsx` + `.module.css` — bottom-of-screen non-modal banner; equal-weight Accept / Reject buttons per Irish DPC guidance (no pre-selected "Accept all")
- `frontend/components/CookiePreferencesLink.tsx` — client button component added to Footer Legal column so users can reopen banner
- `frontend/components/AnalyticsLoader.tsx` — rewritten to use `useCookieConsent()` instead of direct localStorage; GA4 + Microsoft Clarity + Vercel analytics all gated on consent
- `frontend/app/layout.tsx` — `<CookieConsentProvider>` wraps entire tree; old `<CookieConsent />` removed

**Tracking pixels (consent-gated):**
- `frontend/components/MetaPixel.tsx` — loads `fbq` only after `consent === 'accepted'`; exports `trackFbEvent(event, params?, eventId?)` for use throughout app; `event_id` parameter supports deduplication with Meta CAPI
- `frontend/components/PinterestTag.tsx` — loads `pintrk` only after consent; exports `trackPinEvent(event, params?)`
- Both added to `frontend/app/(shop)/layout.tsx`

**Meta Conversions API (server-side):**
- `backend/routes/checkoutV2.js` — `fireMetaCapi({ order, eventId })` function: SHA-256 hashes email/phone/country, posts Purchase event to Meta Graph API v18.0, 3s timeout, silently fails if keys not configured
- Webhook `payment_intent.succeeded`: looks up `Visit` by `sessionId`, copies `visit.utm` to `Order.utm` subdocument, then calls `fireMetaCapi({ order, eventId: 'order-${orderNumber}' })`
- Deduplication: frontend `trackFbEvent('Purchase', ..., eventId)` + CAPI `event_id` both use `'order-' + orderNumber`
- Env vars required: `META_PIXEL_ID`, `META_CONVERSIONS_API_TOKEN` (backend Railway), `NEXT_PUBLIC_META_PIXEL_ID` (frontend Vercel), `NEXT_PUBLIC_PINTEREST_TAG_ID` (frontend Vercel)

**Campaign tracking data layer:**
- `backend/models/Campaign.js` — slug-based campaign document; status lifecycle draft→active→paused→ended; spend log (`spendUpdates[]`), creatives array (`utmContent` keyed), targetProducts, budget
- `backend/models/MarketingAnalysis.js` — one document per day (`dateStr` key); `bullets[]` + `founderBullets[]` + `dataSnapshot`
- `backend/models/Order.js` — extended with `utm: { source, medium, campaign, term, content }` subdocument (from Visit, richer than `attribution` which comes from PI metadata)
- `backend/routes/campaigns.js` — full CRUD: list, create, get+stats, update, add-spend, toggle-status, duplicate
- `backend/routes/marketingDashboard.js` — GET /dashboard (pulse + analysis + campaign rows + top products/creatives/channels/geo), POST /analysis/regenerate, GET /founder
- `backend/services/marketingAnalysis.js` — 7-rule engine: outperforming ROAS≥2×, no orders after €20 spend, creative ≥50 visits 0 orders, active with no spend 3d, channel spike >50%, single product >40% of ad orders, default fallback; `FOUNDER_TRANSLATIONS` map converts bullets to plain-English Sabreen language
- `backend/server.js` — wired `/api/admin/campaigns` + `/api/admin/marketing`

**Admin marketing UI:**
- `frontend/app/admin/marketing/page.tsx` — full rewrite: Today's Pulse band (revenue, orders, ad orders, spend, ROAS, active campaigns), summary line, Today's Read analysis bullets with Regenerate, live campaigns table with status/spend/ROAS, top products + creatives + channel revenue + geo country grids
- `frontend/app/admin/marketing/campaigns/new/page.tsx` — campaign creation form (name, channel, dates, budget, notes); auto-slugifies on backend
- `frontend/app/admin/marketing/campaigns/[id]/page.tsx` — campaign detail: stat band, base UTM link, spend log with inline add form, creatives list with inline add form, attributed orders table
- `frontend/app/admin/marketing/founder/page.tsx` — Sabreen plain-language view: week metric cards, plain-English bullet list from `founderBullets`
- `frontend/app/admin/marketing/utm-builder/page.tsx` — UTM link generator: destination URL, source/medium/campaign/content/term fields, slug preview, copy-to-clipboard

**Files added:**
- `backend/models/Campaign.js`, `backend/models/MarketingAnalysis.js`
- `backend/services/marketingAnalysis.js`
- `backend/routes/campaigns.js`, `backend/routes/marketingDashboard.js`
- `frontend/context/CookieConsentContext.tsx`
- `frontend/components/CookieConsentBanner.tsx`, `.module.css`
- `frontend/components/CookiePreferencesLink.tsx`
- `frontend/components/MetaPixel.tsx`, `frontend/components/PinterestTag.tsx`
- `frontend/app/admin/marketing/page.module.css`
- `frontend/app/admin/marketing/campaigns/new/page.tsx`
- `frontend/app/admin/marketing/campaigns/[id]/page.tsx`
- `frontend/app/admin/marketing/founder/page.tsx`
- `frontend/app/admin/marketing/utm-builder/page.tsx`

**Files modified:**
- `backend/routes/checkoutV2.js` — CAPI + Visit UTM lookup in webhook
- `backend/models/Order.js` — `utm` subdocument added
- `backend/server.js` — campaign + marketing routes wired
- `frontend/app/layout.tsx` — CookieConsentProvider added, old CookieConsent removed
- `frontend/app/(shop)/layout.tsx` — CookieConsentBanner + MetaPixel + PinterestTag added; JustSoldPopup removed
- `frontend/components/AnalyticsLoader.tsx` — uses useCookieConsent hook
- `frontend/components/Footer.tsx` — CookiePreferencesLink added to Legal column
- `frontend/app/admin/marketing/page.tsx` — full rewrite

---

## Shipped 16 May 2026 — Promo codes admin restore + redemption tracking

**Discovery findings:**
- `/admin/promo-codes/page.tsx` was NOT deleted — it was moved to `/admin/marketing/promo-codes/` in commit `06e9b12` (Phase 2A navigation redesign), leaving a redirect at the old URL. Not a regression.
- Only one code advertised in copy: `SILK10` (AnnouncementBar, account page, NewsletterBand, welcome email, seedSiteContent)
- Old PromoCode model used simple `active: Boolean` + no per-customer redemption tracking

**Changes:**
- `backend/models/PromoCode.js` — extended with `status` enum, `redemptionType`, `appliesTo`, `source`, `campaignId` fields; `isActive` virtual resolves both old `active` boolean and new `status` for backward compat
- `backend/models/PromoCodeRedemption.js` (NEW) — one doc per redemption; fields: `promoCodeId`, `code`, `orderId`, `orderNumber`, `customerEmail`, `discountAmount`, `redeemedAt`; compound index on `(promoCodeId, customerEmail)` for per-customer check
- `backend/services/discounts.js` — `validateDiscount` now accepts optional `customerEmail` param; checks `PromoCodeRedemption` for prior redemption when `redemptionType === 'single_use_per_customer'` or legacy `maxUsesPerCustomer === 1`; `redeemDiscount` now accepts `{ orderId, orderNumber, customerEmail, discountAmount }` and creates `PromoCodeRedemption` (idempotent — guards against duplicate webhook calls)
- `backend/routes/checkoutV2.js` — `update-intent` now passes `email || meta.customerEmail` to `validateDiscount`; webhook now passes full redemption context to `redeemDiscount`
- `backend/routes/promoCodes.js` — rewrote: `GET /` supports `status` and `search` query params; `GET /:id` returns full promo + `performance` metrics + `redemptions[]`; `PUT /:id` whitelists specific fields + keeps `active` in sync with `status`; `DELETE` now sets `status: 'expired'` not just `active: false`; new codes set both `status` and `active` fields
- `backend/scripts/seedPromoCodes.js` — rewrote to be idempotent; migrates existing docs without `status` field; seeds SILK10 with `status: 'active'`, `redemptionType: 'single_use_per_customer'`, `source: 'newsletter_welcome'`
- `frontend/components/AdminLayout.tsx` — "Promo codes" entry added to NAV under PUBLISH (below Marketing) with Tag icon from lucide-react
- `frontend/app/admin/promo-codes/page.tsx` — rebuilt as real list page (was a redirect); filter by status, search by code, table with inline Pause/Resume/Duplicate/Delete actions
- `frontend/app/admin/promo-codes/new/page.tsx` (NEW) — 6-section create form: basics, discount type/value/min, applies-to, redemption rules, validity dates, attribution source
- `frontend/app/admin/promo-codes/[id]/page.tsx` (NEW) — detail page: performance band (redemptions/discount/revenue/avg), inline edit form, summary grid, redemptions table with order links and masked emails
- `frontend/app/admin/marketing/promo-codes/page.tsx` — now redirects to `/admin/promo-codes` (reversed the direction)

**Advertised codes — status:**
- `SILK10`: seeded active with 10% off, single use per customer, no expiry, source: newsletter_welcome. Per-customer enforcement is now live (blocked at `update-intent` validate call, and recorded in PromoCodeRedemption on order completion).

---

## Shipped 16 May 2026 — Customer Intelligence v1

**PromoCode personal codes (addendum to promo codes section):**
- `backend/models/PromoCode.js` — `targetCustomerId` field added (ObjectId ref Customer); personal codes can be linked directly to a specific customer
- `frontend/app/admin/promo-codes/page.tsx` — "Personal" pill now renders in the Code column for any code where `targetCustomerId` is set or `source` starts with `customer_`; "Broad only / All codes / Personal only" filter chips added

**Customer model extension:**
- `backend/models/Customer.js` — extended with intelligence fields (all backward-compatible, optional):
  - `tags: [String]`, `notes: [{ body, createdAt }]`, `customerType` (retail/wholesale/vip/internal), `internalRating` (1–5)
  - `firstOrderAt`, `lastOrderAt`, `orderCount`, `totalSpend` — derived stats updated by backfill + webhook
  - `country`, `city` — from last order shipping address
  - `acquisitionSource/Medium/Campaign/CampaignId/VisitId`, `acquiredAt` — first-touch attribution
  - `segments: [String]` — auto-computed slugs
  - `emailLog: [{ subject, template, sentAt }]` — last 100 outbound emails
  - `gdprDeletedAt: Date`, `consent: String` (accepted/rejected/null)
  - Indexes: `segments`, `lastOrderAt`, `totalSpend`

**Segment model + service:**
- `backend/models/Segment.js` — one doc per segment (slug, label, description, color, count, lastComputedAt)
- `backend/services/segments.js` — 7 auto-segments: `vip` (top 10% spend), `repeat` (2+ orders), `first-time` (1 order), `newsletter-only` (0 orders + consent), `recent` (≤30d), `lapsed` (60–180d), `at-risk` (≥90d); `recomputeAll()` bulk-writes all customers in one pass; `ensureSegmentDocs()` idempotent upsert

**Admin customers route:**
- `backend/routes/adminCustomers.js` (NEW) — mounted at `/api/admin/customers`; all routes require admin auth
  - `GET /` — paginated list (page, limit, segment, search, consent filters); returns customers + segment tiles
  - `GET /export/csv` — CSV for Meta Custom Audiences (consent-gated, segment filter)
  - `POST /segments/recompute` — trigger full segment recompute
  - `GET /:id` — full customer detail with orders array + totalSpend
  - `POST /` — manual customer creation (409 if exists, returns customerId for redirect)
  - `PUT /:id` — update whitelisted fields (name, phone, tags, type, rating, consent)
  - `POST /:id/notes` — add internal note; `DELETE /:id/notes/:noteId` — remove note
  - `POST /:id/promo-code` — generate personal one-time code (`FIRSTNAME-XXXX` format); creates PromoCode with `source: 'customer_personal'`, `targetCustomerId`, `maxUses: 1`
  - `GET /:id/gdpr-export` — full PII + orders as JSON download
  - `DELETE /:id/gdpr` — anonymise PII (replaces email, clears name/phone/address/notes/wishlist/tags), preserves order history, sets `gdprDeletedAt`

**Backfill script:**
- `backend/scripts/backfillCustomerOrderLinks.js` — idempotent; links orphan Orders (no customerId) to Customer docs by email; recomputes `firstOrderAt`, `lastOrderAt`, `orderCount`, `totalSpend`, `country`, `city`, acquisition fields; runs full segment recompute at end
- Run: `node backend/scripts/backfillCustomerOrderLinks.js`

**Backend wiring:**
- `backend/server.js` — `adminCustomersRouter` wired at `/api/admin/customers`

**Admin frontend (4 pages):**
- `frontend/app/admin/customers/page.tsx` — paginated list with segment sidebar tiles + "Recompute now" button; search + consent filter bar; table with segments pills, spend, last order; CSV export; pagination
- `frontend/app/admin/customers/[id]/page.tsx` — full detail: 4-cell stat band, profile (editable inline), acquisition attribution, orders table, internal notes (add/delete), personal promo code generator
- `frontend/app/admin/customers/founder/page.tsx` — Sabreen-friendly view: segment tiles with counts + % of total, repeat rate highlight with plain-English interpretation, quick-action buttons
- `frontend/app/admin/customers/new/page.tsx` — manual creation form; on 409 (existing email) redirects to that customer's detail page

**Key decisions / invariants:**
- Customers route at `/admin/customers` already existed in AdminLayout NAV (with Users icon) — no sidebar change needed
- GDPR anonymisation replaces email with `deleted-${id}@anonymised.silkilinen.com` and clears PII; order history rows remain for accounting
- Personal promo codes use `FIRSTNAME-XXXX` format (XXXX = 2 random bytes hex); always `maxUses: 1`, single use per customer, `source: 'customer_personal'`
- Segment recompute is a full table scan (bulk write); safe to run from admin UI at any time

---

## Shipped 17 May 2026 — Finance Tab v1 + Order Total Bug Fix

### Step 0 — Order total bug fix

**Bug:** Orders list page showed `order.total + order.shippingCost` (double-counting shipping). `order.total` already includes shipping per the canonical formula `total = subtotal − discountAmount + shippingCost`.

**Fix:** `frontend/app/admin/orders/page.tsx` — removed the `+ order.shippingCost` from both the row total cell and the expanded inline detail section. Both list and detail now read `order.total` as the canonical persisted value.

**Historical impact:** Order #3BF9D8B3 was showing €10.48 in list (wrong) vs €5.49 in detail (correct). The correct value is €5.49 (€0.50 item + €4.99 Ireland shipping). The order document itself was always correct — only the display was broken.

### Finance Tab v1

**Data models (new):**
- `backend/models/Expense.js` — 15 categories, `isAutomatic` flag for system-created entries (Stripe refunds, campaign spend), `isRecurring` + `recurringFrequency`, `taxDeductible`, `sourceRef` for linking back to origin, `receiptId` FK
- `backend/models/Receipt.js` — Cloudinary file reference; many-to-many linkage with Expense and Order; `totalOnReceipt`, `vendor`, `description` for reconciliation reference (not used for math)

**Data model extensions (existing):**
- `backend/models/Order.js` — `costs: { shippingCost, shippingCostNotes, cogs, stripeFee, refundedAmount }` subdocument; `receiptIds[]`
- `backend/models/Product.js` — `costing: { materialCost, laborCost, packagingCost, totalUnitCost, notes, lastUpdated, updatedBy }` subdocument

**Auto-population sources:**
- `backend/routes/checkoutV2.js` — COGS snapshotted at order creation time: fetches `product.costing.totalUnitCost × quantity` for all line items, stores as `order.costs.cogs`; null if any product has no costing data (never assume zero)
- `backend/routes/checkoutV2.js` — `charge.succeeded` webhook handler: retrieves `balance_transaction.fee` from Stripe, stores as `order.costs.stripeFee` (in EUR, from cents)
- `backend/routes/campaigns.js` — `POST /:id/spend` now auto-creates an Expense doc with `category: 'marketing_ads'`, `isAutomatic: true`, `sourceRef: 'campaign:id'` — marketing spend flows to Finance P&L automatically

**Backend finance routes (`backend/routes/adminFinance.js`, mounted at `/api/admin/finance`):**
- `GET /overview` — current month P&L breakdown (revenue, Stripe fees, COGS, shipping costs, marketing spend, other expenses, refunds, net profit); last 30 days vs prior 30 days deltas; per-order profitability rows (50 most recent, with net profit and missing-data flags); expense category breakdown; soft prompts for missing categories
- `GET /action-items` — orders without shipping cost (>7 days old), products without costing data
- `GET /expenses` — paginated expense ledger with search/category/date filters; year-to-date total
- `POST /expenses` — create expense
- `PUT /expenses/:id` — update (blocks automatic entries)
- `DELETE /expenses/:id` — delete (blocks automatic entries)
- `PATCH /orders/:id/shipping-cost` — set per-order actual shipping cost from Finance Overview modal
- `GET /receipts`, `POST /receipts`, `PUT /receipts/:id`, `DELETE /receipts/:id` — receipt CRUD with Cloudinary upload
- `GET /reports` — 12-month P&L (revenue, refunds, Stripe fees, COGS, shipping costs, expenses, net profit per month); margin by product (last 90 days); margin by acquisition source; anomaly flags

**Frontend (new pages):**
- `frontend/app/admin/finance/page.tsx` — Overview: hero honest-line (red LOSS / green PROFIT with full cost breakdown visible); last-30-day metric cards with delta vs prior period; expense category breakdown bar; per-order profitability table (net profit per order, amber asterisk for missing data, click-to-add shipping cost modal)
- `frontend/app/admin/finance/expenses/page.tsx` — Full expense ledger: search + category + date filters; paginated table with edit/delete row actions (auto entries locked); add/edit modal
- `frontend/app/admin/finance/reports/page.tsx` — Monthly P&L bar chart + detail table; margin by product table; margin by acquisition source table; anomaly flags panel

**Frontend (modified):**
- `frontend/components/AdminLayout.tsx` — FINANCE section added between Publish and Config: Overview · Expenses · Reports; `BookMarked` icon from lucide-react
- `frontend/app/admin/products/[id]/page.tsx` — Costing section added (collapsible, opens by default if no cost data): material/labour/packaging cost inputs, auto-calculated total unit cost with gross margin preview, notes, dedicated "Save costing" button; loads/saves via existing product PUT endpoint
- `frontend/app/admin/products/page.tsx` — Small charcoal dot added to product name in list for any active/sold_out product missing `costing.totalUnitCost`; `costing` field added to Product type

**Post-build report:**
- Historical order total discrepancy: Order #3BF9D8B3 (€10.48 displayed in list, €5.49 actual). The Order document always had the correct `total: 5.49`. Display-only bug, now fixed. No DB correction needed.
- All 4 existing test orders likely have `costs.stripeFee = null` and `costs.shippingCost = null` — Stripe fee capture only fires on `charge.succeeded` going forward; historical orders would need manual entry or a backfill script if needed
- Products without costing data will show the charcoal dot in the admin product list — Sabreena should enter material/labour/packaging costs for each active product so COGS tracking becomes accurate on future orders

**Active scoped work, not yet built (Finance tab phase 2):**
- Receipt upload UI in Finance Expenses page (backend routes exist, frontend UI not yet wired)
- Cash runway projection (needs 2+ months of consistent expense data)
- VAT-readiness tracking if/when revenue approaches Irish VAT threshold
- Quarterly tax-prep export formatted for accountant
- Dashboard "Finance action items" band pulling from `/api/admin/finance/action-items`

---

## Shipped 17 May 2026 — Sunday Build Brief (Journal CMS + Instagram API + Bug fixes)

### Thread 1 — Journal CMS

**Goal:** Writing surface where Sabreena can publish journal articles visible on the public storefront.

**Backend:**
- `backend/models/JournalArticle.js` (NEW) — Mongoose model with fields: title, slug (sparse unique), excerpt, body (Tiptap HTML), heroImage{url,alt,caption}, author (default 'Sabreen'), status (draft/preview/published), publishedAt, scheduledFor, metaTitle, metaDescription, keywords, readingTimeMinutes, viewCount, lastEditedBy; pre-save hook: auto-generates slug from title, auto-calculates readingTimeMinutes (words/230)
- `backend/routes/adminJournal.js` (NEW) — mounted at `/api/admin/journal`; all routes require admin auth; endpoints: GET / (list with status filter), POST / (create), GET /:id, PUT /:id (full save, syncs publishedAt on first publish), POST /:id/autosave (body/title/excerpt only), GET /:id/preview-token (issues 1hr JWT with `type: 'journal_preview'`), DELETE /:id
- `backend/routes/journal.js` (NEW) — mounted at `/api/journal`; public endpoints: GET / (published articles, sorted by publishedAt desc), GET /slug/:slug (individual article, increments viewCount fire-and-forget), GET /preview (validates JWT, returns any-status article for signed preview URLs)
- `backend/scripts/seedJournalArticles.js` (NEW) — idempotent; seeds 3 draft articles from blogPosts.ts content as HTML `<p>` tags
- `backend/server.js` — wired `/api/journal` + `/api/admin/journal`

**Admin frontend:**
- `frontend/app/admin/journal/page.tsx` (NEW) — editorial card list (3-column grid, not a table), filter chips by status, inline quick-create form, empty state
- `frontend/app/admin/journal/[id]/page.tsx` (NEW) — full Tiptap writing canvas: sticky top bar (status pill + saved indicator + action buttons), hero image area, contentEditable title + excerpt, sticky Tiptap toolbar (Bold/Italic/Underline/H2/H3/blockquote/bullet/ordered/link/HR/Image), EditorContent, word count + reading time, collapsible SEO panel (slug/metaTitle/metaDescription/keywords/author)
  - Autosave: 3s debounce after each editor update; Cmd/Ctrl+S triggers explicit save
  - Preview: saves as 'preview', fetches signed JWT, opens `/journal/preview?token=...` in new tab
  - Publish: confirms, sets status 'published'
- `frontend/components/AdminLayout.tsx` — `BookOpen` icon + Journal entry added to NAV (after Promo codes)

**Public frontend:**
- `frontend/app/journal/page.tsx` (NEW) — async server component, ISR 60s, 3-column responsive grid of published articles
- `frontend/app/journal/[slug]/page.tsx` (NEW) — generateMetadata with OG image, article hero + body with `dangerouslySetInnerHTML`, back link
- `frontend/app/journal/preview/page.tsx` (NEW) — client component with Suspense, fetches `/api/journal/preview?token=`, "PREVIEW MODE" sticky purple banner

**BlogTeaser rewrite:**
- `frontend/components/BlogTeaser.tsx` — was a static component with hardcoded posts array; rewritten as async server component fetching from `/api/journal?limit=3` (ISR 60s); returns null if no posts; shows heroImage thumbnail; links to `/journal/[slug]`

**Seed script:** run `node backend/scripts/seedJournalArticles.js` on production to create 3 draft articles.

---

### Thread 2 — Instagram Basic Display API

**Goal:** Replace 6 placeholder SiteContent image tiles on the homepage with real @silkilinen posts from the Instagram API.

**Backend:**
- `backend/routes/instagram.js` (NEW) — mounted at `/api/instagram`
  - In-memory 1hr cache (`posts`, `fetchedAt`, `error`, `tokenRefreshedAt`)
  - `GET /posts?limit=6` — fetches `me/media` with fields id,media_url,permalink,caption,media_type,timestamp; serves stale cache on error; returns `[]` if not configured
  - `GET /status` (requireAuth) — returns cache state: configured, cachedPostCount, fetchedAt, tokenRefreshedAt, lastError
  - `POST /refresh-token` (requireAuth) — calls Instagram `refresh_access_token` endpoint, updates cached token timestamp
  - Env var: `INSTAGRAM_ACCESS_TOKEN` (set in Railway)
- `backend/server.js` — wired `/api/instagram`
- `backend/docs/instagram-setup.md` (NEW) — step-by-step guide: Meta Developer app, Instagram Basic Display product, test user invite, token generation, long-lived token exchange (60d), Railway env var setup, token refresh schedule

**Frontend:**
- `frontend/components/InstagramGrid.tsx` — rewritten as async server component (was `content`-prop-based static component); self-fetching from `/api/instagram/posts?limit=6` (ISR 3600s); returns null if no posts (graceful failure); clickable tiles linking to Instagram permalink; caption overlay on hover; `AbortSignal.timeout(5000)` guard
- `frontend/app/(shop)/page.tsx` — `<InstagramGrid content={content} />` → `<InstagramGrid />` (no more content prop)
- `frontend/app/admin/content/page.tsx` — Instagram tab now shows a connection status panel instead of the old placeholder image tiles: connection status (green dot / red dot), cached post count, last fetch time, token refresh time, auto-refresh note, "Refresh token now" button, last error if any, setup instructions if token not configured

**One-time setup needed:** See `backend/docs/instagram-setup.md`. Гріша must generate an Instagram Basic Display access token and add it to Railway as `INSTAGRAM_ACCESS_TOKEN`.

---

### Thread 3 — Bug fixes

**3A — Cart line item thumbnails missing:**
- Root cause: `CartItem` type had no `image` field; `ProductOptions.tsx` never passed image to `addToCart`; `CartPanel.tsx` rendered an empty div
- Fix: `CartItem` type in `frontend/context/CartContext.tsx` extended with `image?: string`; `ProductOptions.tsx` accepts + passes `image` prop; `/product/[id]` page passes `image={galleryImages[0]?.url}` to `<ProductOptions>`; `CartPanel.tsx` renders `<img>` inside `itemImg` div

**3B — Cart responsiveness (touch targets too small):**
- `frontend/components/CartPanel.module.css` — `stepBtn` width/height 36px → 44px; `stepVal` height/line-height 36px → 44px; added `@media (max-width: 400px)` reducing panel padding to 16px and itemImg to 52×52px

**3C — Hero image admin/display sync:**
- Root cause: `homepage_hero_image` SiteContent record was seeded with `value: ''`; homepage CSS had a hardcoded `background-image: url('/hero.png')` fallback; admin correctly showed "No image" (DB empty) but homepage appeared to show the image (CSS fallback), making admin appear broken
- Fix: `backend/scripts/seedSiteContent.js` — `homepage_hero_image` value changed from `''` to `'/hero.png'`; migration logic added to update existing empty records in place; `frontend/app/(shop)/page.module.css` — removed hardcoded `background-image: url('/hero.png')` from `.hero` class; DB is now single source of truth
- **Run seed script on production:** `node backend/scripts/seedSiteContent.js` to populate the DB value

---

## Shipped 17 May 2026 — Social Composer v1

**Founder principle:** Every social post = +1 to possibility of an order. Adding a new platform should be one form-fill, not an engineering task.

**Architecture:** Not an autoposter. Pure composition workspace + export + manual posting checklist. No OAuth, no cross-posting API calls.

### Three layers

**Layer 1 — Platform Registry (data-driven)**
- `backend/models/SocialPlatform.js` (NEW) — MongoDB collection of platform definitions: key (unique slug), displayName, icon (key for PLATFORM_ICONS frontend map), brandColor, baseUrl, imageSpecs[] (aspectRatio, label, pixelWidth, pixelHeight, isDefault), captionMaxChars, captionRecommended, hashtagsAllowed/Recommended/Max, supportsVideo/Carousel/AltText, tips[], url (the account URL set by admin), isActive, sortOrder
- `backend/scripts/seedSocialPlatforms.js` (NEW) — idempotent `$setOnInsert` seed for 7 platforms: Instagram, Pinterest, Facebook, TikTok, Threads, YouTube, Twitter/X — with full image specs, caption limits, hashtag guidance, brand colors, platform-specific tips
- `backend/routes/adminSocial.js` (NEW) — admin CRUD at `/api/admin/social`:
  - `GET/POST /platforms` — list + create
  - `PUT /platforms/:key` — full update (caption limits, specs, tips, etc.)
  - `PATCH /platforms/:key/url` — set the account connection URL
- `backend/routes/social.js` (NEW) — public endpoint at `/api/social`:
  - `GET /platforms` — returns only active platforms where `url` is non-empty; used by Footer and InstagramGrid

**Layer 2 — Social Connections admin page**
- `frontend/app/admin/social/connections/page.tsx` (NEW) — per-platform URL input forms with per-row Save, CONNECTED badge, Activate/Deactivate toggle, add-platform modal (key/displayName/icon/brandColor/sortOrder). Platform icons rendered via inline SVG map (PLATFORM_ICONS). Domain validation on save.

**Layer 3 — Social Composer**
- `backend/models/SocialPost.js` (NEW) — SocialPost schema: title, defaultCaption, defaultImages[] (url/altText/cloudinaryId), defaultHashtags[], primaryImageIndex, platformVariations[] (platformKey, enabled, customCaption, customImages, customHashtags, customPrimaryImageIndex), postedTo[] (platformKey, postedAt, postedBy, note), status (draft/ready/posted), postedAt, lastEditedBy
- `backend/routes/adminSocial.js` (continued) — post endpoints:
  - `GET/POST /posts`, `GET/PUT /posts/:id`, `POST /posts/:id/autosave`
  - `PATCH /posts/:id/posted-to` — marks platform as posted/unposted; auto-sets status='posted' when all enabled platform variations are checked
  - `POST /posts/:id/images` — multer upload → Cloudinary `silkilinen/social`; appends to `defaultImages`
  - `DELETE /posts/:id/images/:index` — removes by index, destroys Cloudinary asset
  - `DELETE /posts/:id` — deletes post + all Cloudinary images
- `frontend/app/admin/social/page.tsx` (NEW) — index page: status-filtered grid of post cards (thumbnail, title, status badge, platform count, updated time), quick-create with optional title
- `frontend/app/admin/social/[id]/page.tsx` (NEW) — full composer:
  - Left panel: title input, image grid (upload/delete/main-indicator), default caption textarea, default hashtags input, per-platform tabs with custom caption/hashtag editors, tip banners per platform, character count warnings, posting checklist (checkboxes auto-check when all enabled platforms posted)
  - Right panel: phone-style preview with platform header bar, primary image, caption + hashtags rendered together, image spec table
  - Top bar: autosave indicator (2.5s debounce), status dropdown (draft/ready/posted), "Export & track" button, delete button
  - Export & track modal: platform picker, caption copy-to-clipboard, Cloudinary-transformed image downloads per spec (c_fill,w_N,h_M URL transform), mark-as-posted button; checking all platforms auto-advances status to 'posted'

### Wired into the rest of the site

- `backend/server.js` — `/api/admin/social` + `/api/social` mounted
- `frontend/components/AdminLayout.tsx` — Social entry added under Journal in PUBLISH section (Share2 icon from lucide-react)
- `frontend/components/Footer.tsx` — now an async server component; fetches active platforms with URLs from `/api/social/platforms` (revalidate 3600s, 3s timeout fallback); renders social icon row above bottom bar using `.socialIcon` CSS class with hover effect; `FOOTER_ICONS` inline SVG map covers all 7 platform keys
- `frontend/components/InstagramGrid.tsx` — "Follow on Instagram" button URL now fetched from platform registry (`getInstagramUrl()`) instead of hardcoded string; falls back to `https://instagram.com/silkilinen` if registry unavailable

### One-time setup needed

Run the seed script once to populate platform registry: `node backend/scripts/seedSocialPlatforms.js`
Then go to `/admin/social/connections` and enter each platform URL.

---

## Shipped 17 May 2026 — Cart Drawer Polish

Cart drawer was flagged by an outside observer as "cheap feeling" — breaking the brand promise the rest of the site makes. Full visual redesign, no backend changes.

**Files modified:**
- `frontend/components/CartPanel.tsx` — full rewrite
- `frontend/components/CartPanel.module.css` — full rewrite

**Changes:**
- **Image proportions fixed** — thumbnail container changed from 64×64 square to 80×100px (4:5 portrait) on desktop, 64×80px on mobile. `object-fit: cover` on the `<img>`. No more squashed/stretched models.
- **Typography hierarchy** — product name: Cormorant Garamond 17px, charcoal, 2-line clamp. Color/size: 13px muted. Price: 15px semi-bold, charcoal, `font-variant-numeric: tabular-nums` so prices align across items.
- **Quantity stepper redesigned** — container border changed from `var(--border)` (light gray) to `var(--dark)` (charcoal) — assertive and deliberate. Stepper is 36px tall × inline-flex. Buttons have proper hover (cream fill) and disabled (0.4 opacity) states.
- **Remove button** — now a proper button using Lucide `X` icon (13px stroke 1.5), min 44×44px touch target, positioned on the price row (price left, remove right) within the info column. Previously floated outside the item as a literal `✕` character.
- **Item layout restructured** — `align-items: flex-start` so image and info column align from top. Info column: name → color/size → (price + remove) → stepper. Clean two-column grid per item.
- **Header** — reduced to 22px, added gray item count "(2 items)" beside the heading. Close button uses Lucide `X` icon (was `✕` character). 1px bottom border separator.
- **Free shipping progress** — thin 3px charcoal progress bar in the footer. Shows "€XX more for free shipping to Ireland" (€150 threshold). When met: quiet green "Free shipping to Ireland ✓" line.
- **Sticky footer — always visible** — Subtotal row (gray, 13px) + Shipping "Calculated at checkout" row + **Total row** (17px semi-bold charcoal, border-top separator). The "Total" equals subtotal since shipping is unknown at cart stage — honest and standard.
- **Checkout button** — 52px tall on desktop, 56px on mobile. Same charcoal/cream brand style, 0.85 hover opacity.
- **Trust signal** — "Secure checkout · Stripe" with Lucide `Lock` icon (11px). Replaces bare "Secure checkout via Stripe" text.
- **Empty state redesigned** — "Your cart is empty." (Cormorant 22px, serif) + italic subtitle "When you add silk, it'll live here until you check out." + "Shop the collection" ghost button. Generous 64px vertical padding.
- **Promo code** — was not in cart drawer; confirmed correct. Promo codes belong exclusively at /checkout.
- **Responsive** — 480px breakpoint reduces image to 64×80, padding to 20px, checkout button to 56px tall. 360px breakpoint sets panel to 100vw and shrinks image further.

**Post-build notes:**
- The "Total" row at cart stage shows the same value as Subtotal since no shipping calculation has run yet. This is intentional and honest — exact total is shown at /checkout once country and promo code are applied.
- Touch targets: stepper buttons are 36px visual but the stepper container's inline nature means they're tappable at their full size; remove button is 44×44px min. All primary actions meet WCAG 2.1 touch target minimums.
- The cart drawer is the same CartPanel component used for the slide-out drawer. The /checkout page has its own order summary — changes here did not touch checkout.

---

---

## Shipped 18 May 2026 — Frontend UX Fixes

Full React/UX review pass. Issues found by an AI senior-engineer review prompt.

**Files modified:**
- `frontend/components/Navbar.tsx`
- `frontend/components/Navbar.module.css`
- `frontend/components/ProductGrid.tsx`
- `frontend/components/ProductGrid.module.css`
- `frontend/components/SideMenu.tsx`
- `frontend/components/SideMenu.module.css`
- `frontend/app/(shop)/page.module.css`

**Changes:**

**1 — Desktop navigation links added (highest UX impact)**
The navbar previously showed only a hamburger on every screen size — all category navigation was hidden behind a drawer on desktop. On screens ≥1024px, key nav links now appear directly in the left column: Shop · Robes · Pyjamas · Sleepwear · Journal · About. Active link gets an underline via `usePathname`. Hamburger stays for the full SideMenu drawer. `DESKTOP_NAV` constant at top of `Navbar.tsx` is the single place to add/remove entries.

**2 — Touch targets fixed (mobile critical)**
- `heartBtn` (wishlist): 36×36px → 44×44px; repositioned from `top: 14px / right: 14px` to `top: 6px / right: 6px` to preserve visual placement.
- `plusBtn` (add to cart): remains 36px on desktop, expanded to 44×44px on mobile via `@media (max-width: 768px)`.
- `filterBtn` (category filters): added `min-height: 44px` + `inline-flex` alignment for touch compliance.

**3 — Filter bar horizontal scroll on mobile**
At ≤768px: `flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none`. Previously nine categories + "All" wrapped to 3–4 rows and buried the product grid.

**4 — SideMenu category skeleton loading state**
Three shimmer skeleton rows (CSS `@keyframes shimmer` animation) replace the empty gap while `/api/categories` resolves. `catsLoading` boolean state, reset false on success or catch. Skeleton uses the same border-bottom styling as real nav links for visual continuity.

**5 — Hero section fallback background**
Added `background-color: #e8e2d8` + `background-image: linear-gradient(160deg, #ede7db, #d9d0c3)` as CSS fallback on `.hero`. When the CMS `homepage_hero_image` is unset, hero now renders a warm parchment gradient instead of white-on-white illegibility.

**6 — Empty product state improvement**
`ProductGrid` empty state now includes a "Browse all products" ghost button (charcoal border, 44px tall, uppercase Jost, hover fills dark) that calls `selectCategory('all')`. Previously only showed italic muted text.

**7 — Search uses router.push**
`Navbar.tsx` search now uses `router.push()` from `next/navigation` instead of `window.location.href`. SideMenu search retains `window.location.href` (closes panel first with 50ms delay, then navigates) because `router.push` inside a closing drawer causes a race condition.

**Vercel TS fix (same session):**
`frontend/components/Footer.tsx` — `FOOTER_ICONS` type changed from `JSX.Element` (global namespace unavailable in this Next.js version) to `ReactElement` from `'react'`. Import added: `import type { ReactElement } from 'react'`.

---

## Security Audit — 18 May 2026 (verification pass 28 May 2026)

Full static-analysis security audit on 18 May 2026. Verification pass 28 May 2026 confirmed H1, H2, H3, M1, M5, L1 are FIXED with quoted code evidence. M6 partially fixed (3 specific leak sites remain, all admin-only). M2, M3, M4, L2, L3 not yet verified.

### HIGH — Status

**H1 — Stored XSS via `dangerouslySetInnerHTML` on journal article body**
- File: `frontend/app/journal/[slug]/page.tsx`
- Status (28 May 2026): **FIXED.** `isomorphic-dompurify ^3.13.0` pinned in `frontend/package.json`. Import at top of file; `DOMPurify.sanitize(article.body)` wraps the single render point.

**H2 — Google OAuth audience check fails open when `GOOGLE_CLIENT_ID` is unset**
- File: `backend/routes/customers.js`
- Status (28 May 2026): **FIXED.** Fail-closed guard `if (!clientId) return 503` runs before the `aud` check. Issuer (`iss`) check also implemented against both canonical Google issuers — this closes L1 in the same change.

**H3 — HTML injection in Drop a Hint email via unescaped user input**
- File: `backend/services/email.js`
- Status (28 May 2026): **FIXED.** `esc()` helper at top of file does HTML entity escaping. All three originally vulnerable fields (`message`, `recipientName`, `senderName`) routed through `esc()` before interpolation. URL fields (`productUrl`, `productImage`) have an `^https?://` allowlist guard.

### MEDIUM — Status

**M1 — `jwt.verify()` without explicit `algorithms` option**
- File: `backend/middleware/auth.js`
- Status (28 May 2026): **FIXED.** `{ algorithms: ['HS256'] }` explicitly set.

**M2 — Admin JWT returned in response body**
- File: `backend/routes/auth.js`
- Status: Not yet verified. Manual check needed: confirm whether admin frontend stores token in `localStorage` (high risk in combination with any future XSS) or in an `HttpOnly` cookie.

**M3 — Frontend admin middleware checks cookie presence only, not JWT validity**
- File: `frontend/middleware.ts`
- Status: Not yet verified.

**M4 — No HTTP security headers on the frontend**
- File: `frontend/next.config.ts`
- Status: Not yet verified. Manual check: `curl -I https://silkilinen.com` to see which headers Vercel sets automatically vs which need to be added.

**M5 — Mass assignment in admin products create and update**
- File: `backend/routes/adminProducts.js`
- Status (28 May 2026): **FIXED.** `PRODUCT_ALLOWED_FIELDS` allowlist with `pickProductFields()` applied in both create and update handlers. Stripped fields logged server-side via `console.warn`.

**M6 — Internal error messages exposed to clients**
- Files: `backend/routes/checkoutV2.js`, `backend/routes/aiPhotos.js`, `backend/routes/campaigns.js`
- Status (28 May 2026): **PARTIAL.** Most catch blocks fixed; three leak sites remain, all admin-only:
  - `checkoutV2.js` line 261–262 — Stripe webhook signature error leaks `err.message` in the 400 response. Caller is Stripe servers, not customers. Low risk.
  - `aiPhotos.js` line 411 — per-item generation result pushes raw `err.message` into the response array. Admin panel surface. Exposes Gemini/Cloudinary internals to admins.
  - `aiPhotos.js` line 269 — `classifyError` daily_limit branch returns raw `err.message` as `userMessage`. Same admin surface.
- `campaigns.js` fully fixed (all 4 handlers return generic 'Internal server error').

### LOW — Status

**L1 — Google OAuth missing `iss` (issuer) validation**
- File: `backend/routes/customers.js`
- Status (28 May 2026): **FIXED** (as side-effect of H2 fix). Both `accounts.google.com` and `https://accounts.google.com` checked.

**L2 — Geolocation lookup over HTTP**
- File: `backend/routes/track.js:24`
- Status: Not changed. Still HTTP. Low risk.

**L3 — Magic link verify endpoint has no rate limiter**
- File: `backend/routes/customers.js` — `POST /verify-magic-link`
- Status: Not yet verified.

### Still open / next pass

In priority order:
1. **M6 partial cleanup** — fix the 3 remaining admin-facing error leaks in `aiPhotos.js` (replace raw `err.message` with classified codes).
2. **M2 + M3** — verify how admin frontend stores and reads the JWT; tighten middleware check if needed.
3. **M4** — add HTTP security headers to `next.config.ts`; check HSTS first via `curl -I https://silkilinen.com`.
4. **L2** — switch ip-api.com call to HTTPS (one-character change).
5. **L3** — add `publicWriteRateLimit` to magic-link verify route.

### Needs manual check

1. `unsubscribeToken` generation in `backend/models/Newsletter.js` — confirm it uses `crypto.randomBytes()`.
2. Drop a Hint route caller — confirm whether `message`, `recipientName`, `senderName` have input validation (e.g. max length) before reaching `services/email.js`. The HTML injection vector is closed, but request-size DoS is still possible if there's no length cap.

---

## Active scoped work, not yet built

- **Finance tab phase 2** — receipt upload UI (backend done), cash runway projection (needs 2+ months data), dashboard "Finance action items" band, quarterly tax-prep export, VAT threshold tracking
- **Social Composer phase 2** — per-platform custom image override (upload per-variation image), scheduled posting reminders, Instagram grid preview (shows last N posts alongside composer)
- **THUMBNAIL slot auto-derive** — thumbnail generation still exists in AI workflow tiers but no named slot card shows for it; images with `slot: thumbnail` appear in Additional images. Future: auto-derive from HERO via Cloudinary transformation if needed.
- **Collections header nav** — dynamic nav rebuild around collections (static category nav still in place)
- **Collections heroImage upload** — admin edit page shows heroImage URL fields; Cloudinary upload widget not yet wired for collections
- ~~**Stripe live mode + real test order**~~ ✓ Shipped 16 May 2026 (€5.49 order from Sabreena, €5.08 payout deposited 21 May 2026, fee €0.41 captured by `charge.succeeded` webhook). Refund path not yet tested with a real card — do this on the second real order, not by refunding Sabreena's.
- **Pricing spreadsheet** for the actual catalogue with cost-up + margin + Etsy fee comparison. Needs real Etsy sales data first.
- **Finance admin tab** ("captain's cabin") — daily revenue, monthly P&L, margin tracking, cash flow. Phase 2D.
- ~~**GDPR cookie banner**~~ ✓ Shipped 16 May 2026
- **Customer messaging system** — contact form + admin inbox + push notifications on new message.
- **PWA admin app** with push notifications for orders, low stock, system health, messages. Phase 2C.
- **VPS migration** — considered, not executed. Real architectural decision, deserves its own brief.


## Where to start a new Claude chat about SILKILINEN

Paste this whole file at the top of the new chat, or just point to the `SILKILINEN.md` path in the repo root. Tell Claude:

> "I'm working on SILKILINEN. Current state is in this doc. Today I want to work on X."

That keeps every new conversation grounded in real state instead of stale assumptions.

---

## Strategy reality-check (read before acting on prior strategy docs)

The strategic documents from the previous Claude chat (Marketing Foundation, Donegal Motif Strategy, Pricing Strategy v1, Maeve persona work) were built on assumptions that don't match the current business reality. Specifically:

- The persona "Maeve" is a 32-year-old slow-fashion buyer with €200 budget for silk slip dresses. The actual current customer profile is unknown but the volume-buying-silk-panties-on-Etsy data suggests it's different.
- The Donegal motif strategy is a beautiful long-term vision but adds complexity. Founders paused it.
- Pricing tiers (accessible €60-90 / staple €120-180 / hero €200-300) were specified without seeing real Etsy sales numbers.

Before acting on any of those docs, pull real Etsy data: units per month, average price, top items, repeat rate, geographic distribution. Recalibrate from there.

The technical work and operational infrastructure stand on their own — those don't depend on the strategy being right. The site, admin, and tooling are usable for whatever business shape emerges from the data.
