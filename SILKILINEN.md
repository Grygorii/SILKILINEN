# SILKILINEN — Project State

Living document. Update this file every time a change is shipped to the SILKILINEN project.

Last updated: 19 May 2026 (Header polish + Product page sticky panel + mobile buy bar).

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
- **Payments:** Stripe (currently test mode — verify before launch)
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

## Shipped 19 May 2026

### Header polish (sticky container + icon consistency)

- **SiteHeader wrapper** (`components/SiteHeader.tsx` + `SiteHeader.module.css`) — single `position: fixed` container wraps both `AnnouncementBar` and `Navbar`. Mobile hide-on-scroll transforms the entire block via `data-scrolled-down` attribute, eliminating the empty gap left by the previous approach (transforming only the bar).
- **Icon consistency** — all header icons are now uniform outline `lucide-react` strokes (`strokeWidth={1.5}`). `Heart` no longer fills when wishlist has items (always outline). Logged-in state shows `<User>` icon (not filled avatar circle with initial). Signed-in greeting ("Hi, Firstname") moves inside the account dropdown as first item. `AnnouncementBar` and `Navbar` reverted to non-fixed positioning (SiteHeader owns it).

**Files modified/created:** `SiteHeader.tsx`, `SiteHeader.module.css`, `components/Navbar.tsx`, `components/Navbar.module.css`, `components/AnnouncementBar.tsx`, `components/AnnouncementBar.module.css`, `app/(shop)/layout.tsx`

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

## Security Audit — 18 May 2026

Full static-analysis security audit of the backend and frontend. No live exploitation testing was performed — all findings are from reading code. Findings are graded HIGH / MEDIUM / LOW.

### HIGH — Fix immediately

**H1 — Stored XSS via `dangerouslySetInnerHTML` on journal article body**
- File: `frontend/app/journal/[slug]/page.tsx:84`
- `article.body` is rendered via `dangerouslySetInnerHTML={{ __html: article.body }}` with no sanitization. If the admin account is compromised, an attacker can store arbitrary JavaScript in any article body — that script then runs in the `silkilinen.com` origin for every visitor.
- Fix: install `isomorphic-dompurify`; wrap with `DOMPurify.sanitize(article.body)` before passing to `dangerouslySetInnerHTML`.
- Status: **NOT YET FIXED** — pending.

**H2 — Google OAuth audience check silently skipped when `GOOGLE_CLIENT_ID` env var is unset**
- File: `backend/routes/customers.js` (Google auth handler)
- `if (clientId && payload.aud !== clientId)` — if `GOOGLE_CLIENT_ID` is not set, the audience check is silently skipped. Any valid Google-issued token from any app is accepted.
- Fix: fail closed — `if (!clientId) return res.status(503).json({ error: 'Google auth not configured' });` before the `aud` check.
- **Manual check needed:** confirm `GOOGLE_CLIENT_ID` is set in Railway. If absent, this is exploitable in production right now.
- Status: **NOT YET FIXED** — pending.

**H3 — HTML injection in Drop a Hint email via unescaped user input**
- File: `backend/services/email.js:375`
- `message`, `recipientName`, `senderName` are interpolated directly into an HTML email template string without escaping. An attacker can inject arbitrary HTML into the recipient's email (phishing links, tracking pixels).
- Fix: add an `esc(s)` helper function and apply to all user-supplied values before interpolation.
- Status: **NOT YET FIXED** — pending.

### MEDIUM

**M1 — `jwt.verify()` without explicit `algorithms` option**
- File: `backend/middleware/auth.js:7`
- No `{ algorithms: ['HS256'] }` option. In jsonwebtoken < 9.0.0 this allows algorithm confusion attacks.
- Fix: `jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })`
- Manual check needed: confirm jsonwebtoken version ≥ 9.0.0 in `backend/package.json`. If ≥9, library defaults mitigate this but explicit is still best practice.

**M2 — Admin JWT returned in response body**
- File: `backend/routes/auth.js` (login response)
- `res.json({ success: true, token })` — if frontend stores in `localStorage`, any XSS (including H1) can exfiltrate admin credentials.
- Manual check needed: verify how the admin frontend stores and reads this token.

**M3 — Frontend admin middleware checks cookie presence only, not JWT validity**
- File: `frontend/middleware.ts`
- `request.cookies.get('token')` truthy check only. Any non-empty cookie named `token` bypasses the redirect to `/admin/login`. Actual API calls are still protected by `requireAuth`.
- Fix: verify JWT format at minimum (`/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)`); ideally use `jose` for edge-compatible signature verification.

**M4 — No HTTP security headers on the frontend**
- File: `frontend/next.config.ts`
- No `headers()` export. Missing: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. CSP requires iterative rollout due to inline styles.
- Fix: add `async headers()` to `next.config.ts` with the above headers on `source: '/(.*)'`.
- Manual check needed: confirm whether Vercel sets `Strict-Transport-Security` automatically (check response headers in production before adding HSTS manually).

**M5 — Mass assignment in admin products create and update**
- File: `backend/routes/adminProducts.js` — create (`...req.body` spread), update (`Object.assign(product, rest)` where `rest = req.body` minus images)
- Admin-only, so exploitable only post-admin-compromise. But combined with XSS (H1) → admin session → arbitrary field write.
- Fix: explicit field allowlist on both create and update, matching the pattern already used in `campaigns.js` update route.

**M6 — Internal error messages exposed to clients**
- Files: `backend/routes/checkoutV2.js:173`, `backend/routes/aiPhotos.js:319`, `backend/routes/campaigns.js:109`, and most other route catch blocks
- `res.status(500).json({ error: err.message })` exposes MongoDB error strings, Stripe error internals, and strings like `'GEMINI_API_KEY is not set'`.
- Fix: `console.error('[route] error:', err); res.status(500).json({ error: 'Internal server error' })` in all generic catch blocks.

### LOW

**L1 — Google OAuth missing `iss` (issuer) validation**
- File: `backend/routes/customers.js` (Google auth handler)
- No check for `payload.iss === 'accounts.google.com'`. Theoretical in practice (Google's tokeninfo server only accepts valid Google tokens) but defense-in-depth recommends explicit validation.

**L2 — Geolocation lookup over HTTP**
- File: `backend/routes/track.js:24`
- `fetch('http://ip-api.com/json/...')` — HTTP only; MITM could inject false geo data into analytics. No credentials exposed.

**L3 — Magic link verify endpoint has no rate limiter**
- File: `backend/routes/customers.js` — `POST /verify-magic-link`
- Token entropy is 256-bit; brute force is infeasible. Single-use + 15-minute expiry limits replay. Low priority.
- Fix: add `publicWriteRateLimit` to the route for defense-in-depth (one-line change).

### Needs manual check (cannot verify from static analysis)

1. **jsonwebtoken version** — `grep '"jsonwebtoken"' backend/package.json` — if < 9.0.0, M1 is actively exploitable.
2. **Admin token storage** — check `frontend/context/` or wherever the admin login token is consumed. If `localStorage`, M2 + H1 together allow full admin takeover via a single XSS hit.
3. **`GOOGLE_CLIENT_ID` in Railway** — if unset, H2 is actively exploitable right now.
4. **Vercel HSTS** — `curl -I https://silkilinen.com` — check if `Strict-Transport-Security` header is already set by Vercel before adding it manually.
5. **`unsubscribeToken` generation** — read `backend/models/Newsletter.js` to confirm token is `crypto.randomBytes()`-based. If weak, `GET /api/newsletter/unsubscribe/:token` can be enumerated to mass-unsubscribe all subscribers.
6. **Drop a Hint call site** — find the route calling `sendDropAHint()` and verify whether `message`, `recipientName`, `senderName` have any input validation before reaching `services/email.js`. If none, H3 is live.

### Priority order for remediation

H2 (check env var today, zero-code fix) → H1 (DOMPurify install + one-line wrap) → H3 (escape helper in email.js) → M4 (security headers, 30-minute job) → M1 (add `algorithms` option, trivial) → M6 (generic 500 responses across routes) → M5 (product allowlist) → M3 (middleware JWT check) → L1–L3.

---

## Active scoped work, not yet built

- **Finance tab phase 2** — receipt upload UI (backend done), cash runway projection (needs 2+ months data), dashboard "Finance action items" band, quarterly tax-prep export, VAT threshold tracking
- **Social Composer phase 2** — per-platform custom image override (upload per-variation image), scheduled posting reminders, Instagram grid preview (shows last N posts alongside composer)
- **THUMBNAIL slot auto-derive** — thumbnail generation still exists in AI workflow tiers but no named slot card shows for it; images with `slot: thumbnail` appear in Additional images. Future: auto-derive from HERO via Cloudinary transformation if needed.
- **Collections header nav** — dynamic nav rebuild around collections (static category nav still in place)
- **Collections heroImage upload** — admin edit page shows heroImage URL fields; Cloudinary upload widget not yet wired for collections
- **Stripe test orders** — register `STRIPE_WEBHOOK_SECRET` in Railway pointing at `POST /api/webhook` (events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.succeeded`), then place a real end-to-end order on the live site to verify the checkout flow
- **Stripe test orders** — must place real test orders on the v2 checkout path before going live
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
