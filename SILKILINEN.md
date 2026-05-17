# SILKILINEN — Project State

Living document. Update this file every time a change is shipped to the SILKILINEN project.

Last updated: 17 May 2026 (Journal CMS + Instagram API integration + cart/hero bug fixes).

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

**Product page (as of 15 May 2026):** Multi-image gallery with desktop vertical thumbnail strip + main image; mobile touch-swipe with page dots. Video renders in gallery sequence (Cloudinary `so_0,f_jpg` poster). Story sentence from `description` visible above price. PRODUCT DETAILS accordion open by default. One-size products auto-select. Free shipping reminder below price. Heart: no white circle, charcoal fill, portal-fixed z-index. Contact button: speech bubble icon, response time line. Colour cubes instead of hex swatches (both on product page and shop grid). Footer: "14-day hassle-free returns".

## Admin tooling shipped

Mobile-first admin panel — sidebar on desktop, drawer + bottom-tabs on mobile. Seven sections: Dashboard, Products, Orders, Customers, Marketing, Content, Settings.

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

## Active scoped work, not yet built

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
