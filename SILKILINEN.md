# SILKILINEN — Project State

Living document. Update this file every time a change is shipped to the SILKILINEN project.

Last updated: 16 May 2026.

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

**Product page (as of 15 May 2026):** Multi-image gallery with desktop vertical thumbnail strip + main image; mobile touch-swipe with page dots. Video renders in gallery sequence (Cloudinary `so_0,f_jpg` poster). Story sentence from `description` visible above price. PRODUCT DETAILS accordion open by default. One-size products auto-select. Free shipping reminder below price. Heart: no white circle, charcoal fill, portal-fixed z-index. Contact button: speech bubble icon, response time line. Colour cubes instead of hex swatches (both on product page and shop grid). Footer: "14-day returns" (removed "hassle-free").

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
- `backend/routes/checkoutV2.js` — `/create-intent` validates items, creates Stripe PaymentIntent with items + discount + shipping in metadata; `/webhook` handles `payment_intent.succeeded`, creates Order with orderNumber
- **PARALLEL BUILD — existing Stripe Checkout path unchanged.** Do NOT cut over until real test orders verified
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
- Privacy Policy: effective date updated, cookies section rewritten (essential only, no analytics cookies, no banner yet)
- Terms: effective date updated to 1 May 2026
- Footer: "14-day hassle-free returns" → "14-day returns"

## Active scoped work, not yet built

- **THUMBNAIL slot auto-derive** — thumbnail generation still exists in AI workflow tiers but no named slot card shows for it; images with `slot: thumbnail` appear in Additional images. Future: auto-derive from HERO via Cloudinary transformation if needed.
- **Collections header nav** — dynamic nav rebuild around collections (static category nav still in place)
- **Collections heroImage upload** — admin edit page shows heroImage URL fields; Cloudinary upload widget not yet wired for collections
- **New checkout cutover** — `/checkout` page built and tested (parallel). Cut over: wire "Checkout" button in CartPanel to go to `/checkout`; configure `STRIPE_WEBHOOK_SECRET_V2` env var in Railway; place real test orders; then cut over
- **Stripe test orders** — must place real test orders on the v2 checkout path before going live
- **Pricing spreadsheet** for the actual catalogue with cost-up + margin + Etsy fee comparison. Needs real Etsy sales data first.
- **Finance admin tab** ("captain's cabin") — daily revenue, monthly P&L, margin tracking, cash flow. Phase 2D.
- **GDPR cookie banner** with equal-prominence Accept/Reject. Required before any paid-ads tracking pixels.
- **Customer messaging system** — contact form + admin inbox + push notifications on new message.
- **PWA admin app** with push notifications for orders, low stock, system health, messages. Phase 2C.
- **VPS migration** — considered, not executed. Real architectural decision, deserves its own brief.

## Known bugs / minor

- Logo CSS: `letter-spacing` adds trailing space after the last glyph, visually shifting letter-spaced text left of center. Fixed 14 May 2026 — `align-items: center` on `.logoLink` + `padding-right` matching `letter-spacing` on each text span.
- Mongoose duplicate-index warnings on `Product.slug`, `Customer.email`, `Customer.googleId` — cosmetic in logs, not affecting functionality
- Microsoft Clarity tracker firing — origin unknown, investigate before enabling any paid-ads pixels
- `finalize()` in AiPhotoshoot (bulk-approve all photos at once) does not auto-route to slots — only individual `approvePhoto()` does. Bulk-finalized photos land in Additional images.
- Some env vars previously orphaned (`subject`, `to`, `body`, etc.) — clean-up done 8 May, worth a monthly env audit habit

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
