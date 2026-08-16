# PROJECT_MAP — SILKILINEN

Orientation map so an agent can act without re-exploring. Luxury silk/linen
intimates e-commerce. **Keep this current**: when you add a route/model/service
or change an invariant, update the relevant line here in the same commit.

## Stack & hosting
- **frontend/** — Next.js 16 (App Router, React), Vercel. ⚠️ Next 16 is NOT the
  Next you know — `params`/`searchParams` are **Promises** (await them). Read
  `frontend/node_modules/next/dist/docs/` before using an unfamiliar API. See
  `frontend/AGENTS.md`.
- **backend/** — Express + MongoDB (Mongoose), Railway. Entry `backend/server.js`.
- **legacy/** — old code, ignore unless asked. **docs/** — ADRs/decisions.
- Payments: **Stripe**. Media: **Cloudinary**. AI: **DeepSeek** (text) + **Gemini** (vision/image).
- No PHP anywhere. Node engine (backend): `>=20 <25`.

## Deploy / git
- Work commits to **master** this session (topic branches `claude/*` merged in).
- Co-author footer required on commits. Model id must NOT appear in commits/code.
- **Egress is blocked** to silkilinen.com / api.silkilinen.com — cannot test live;
  instruct the founder to run seeds/tests on the Railway shell.

## Money path (CRITICAL — change with care)
- `backend/routes/checkoutV2.js` mounted at `/api/v2/checkout`. Webhook at `/api/webhook`.
- **`priceOrder(body)` is the ONE pricer.** `/quote` returns `orderSummaryOf(priced)` with
  NO Stripe call; `/create-intent` calls the same function then creates the intent. The
  totals shown can never drift from the totals charged. Checkout **quotes on load and
  creates the intent only when the customer clicks "Continue to payment"** — creating it on
  load made every visitor who merely opened checkout an "Incomplete" payment in Stripe,
  burying real abandoned carts. Once an intent exists, a cart change still recreates it.
- **EUR is canonical** for all order economics/reporting. Multi-currency (EUR/GBP/USD)
  converts ONLY at display + the Stripe charge. EUR path must stay byte-identical (rate 1).
- `backend/services/exchangeRates.js` — SUPPORTED currencies, `getRates()` (frankfurter.app,
  cached 6h, fallback {EUR:1,GBP:0.84,USD:1.08}), `normalise`, `convert`. Route `/api/rates`.
- Stripe PaymentIntent metadata caps each value at 500 chars → `packItems/unpackItems`
  chunk the cart JSON across `items`/`items1`/`items2`. Intent currency is fixed for life.
- Order doc carries canonical EUR + `displayCurrency`, `exchangeRate`, `chargedTotal`.
- Frontend: `context/CurrencyContext.tsx` + `components/Price.tsx` (`<Price eur={}/>`),
  persists `slk_currency`. Checkout `app/(shop)/checkout/page.tsx` re-creates the intent
  on currency/cart change (cartKey effect + `<Elements key={clientSecret}>`).

## AI agents (the "house") — backend/services/
- **archivarius.js** — shared memory + the founder **Library** (links/books the agents
  learn from). `memoryBlock()` injected into agent prompts. Model `MemoryEntry`.
  Admin: `/admin/memory`, routes `adminMemory.js`. Seed `scripts/seedLibrary.js`.
- **atelier.js** — creative-director vision review of every "room" (page) via Gemini +
  screenshot (`screenshot.js` mShots). Critics in `atelierCritics.js`. Model `ExperienceReview`.
  Admin `/admin/atelier`, routes `adminAtelier.js`.
- **atelierAlt.js** — Atelier's eye on the CATALOGUE: writes product-image alt text via
  Gemini Vision. Auto-invoked by the Site Audit when alt is missing. `POST /api/admin/atelier/alt`.
- **auditAgents.js** — Site Audit: navigation/journeys/consistency/seo agents +
  `auditPageHtml` (title/meta/canonical/alt checks) + `measureWebVitals` (PageSpeed API).
  Live-data driven (reads real categories/products). Model `SiteAudit`, route `/api/admin/site-audit`.
- Others: **advisor/analyst/chiefOfStaff/growthEngine/marketingCoordinator/davinci
  (image)/journalWriter/competitor\*/seoIntel/merchantCenter/searchConsole**. Each has a
  matching `adminX` route + `/admin/X` page. `aiClient.js`=DeepSeek, `aiImageRouter.js`=image providers.
- Gemini gated by `GEMINI_API_KEY`; agents are fail-soft/inert without their key.

## Backend layout
- **routes/** — public + `adminX.js` (admin, behind `requireAuth`). Mounts in `server.js`
  (grep `app.use('/api`). Rate limit: `middleware/rateLimiters.js` `aiLimit`.
- **models/** — 35 Mongoose models. Core: `Product` (variants, images[].alt, slug+previousSlugs,
  EUR price, metaTitle/Desc), `Order`, `Cart`, `Customer`, `Review` (starRating, reply, status,
  source:'seed'), `Category`/`Collection`/`Bundle`, `Journal Article`, `SiteContent` (CMS KV),
  `MemoryEntry`, `SiteAudit`, `ExperienceReview`, `User`.
- **scripts/** — seeds (`seed*.js`) + migrations. Run on Railway shell with `node scripts/X.js`.
  Notable: `seedProductReviews.js --reset` (panties-focused, fresh dates), `seedLibrary.js`.
- **services/** — business logic + the AI agents above.

## Frontend layout
- **app/(shop)/** — storefront. `layout.tsx` mounts InlineEditProvider + SiteBreadcrumbs +
  UKShippingNotice. Home `page.tsx` (hero image is LCP; `HeroVideo.tsx` loads late). Key routes:
  product/[id], shop, collections/[slug], checkout, reviews, style-finder, account.
- **app/admin/** — admin console, one folder per agent/feature. `layout.tsx` = AdminLayout
  (nav array lists every page). **Content editing**: `/admin/content` ("Site Content" nav) =
  the CMS editor (SiteContent KV, tabs Banner/Homepage/Categories/About/Instagram); `/admin/pages`
  = per-page overview that deep-links into it. The **announcement bar** text is `banner_message_1..4`
  (section `banner`); if absent in DB, `components/AnnouncementBar.tsx` falls back to hardcoded
  defaults. Seed/restore with `backend/scripts/seedSiteContent.js` (idempotent).
- **components/** — incl. `inline/InlineEdit.tsx` (WYSIWYG `?edit=1`), `Price.tsx`,
  `ProductReviews.tsx`, `Navbar`, `CurrencySwitcher`, `SiteBreadcrumbs`.
- **context/** — Cart, Currency, Wishlist, Customer, CookieConsent (nested in `app/layout.tsx`).
- **lib/** — `clampMeta` (≤160 meta desc), `cloudinaryLoader` (f_auto,q_auto transforms),
  `content`/`pageSeo` (CMS + SEO fetch), `safeJsonLd`, `orderMoney`, `uploadSpecs`.

## SEO Base (the "site plan")
- **`backend/routes/adminSeoBase.js`** (`/api/admin/seo-base`) — GET aggregates every
  indexable URL's meta (products/categories/collections + `pageSeo` static pages) with
  snippet-length health; PATCH saves an edit back to the owning store. POST `/autofix`
  (Hermes' hands) fills only MISSING meta via `aiText` `generateProductSEO`/`generateSEO`,
  safe-only (never URLs/content), returns a was→became report.
- **`frontend/app/admin/seo/SeoBasePanel.tsx`** — the editable table + auto-fix button +
  report + per-row Yoast-style "Preview & checks" (Google snippet + focus-phrase checklist).
  Rendered as the **"Base" tab** inside `app/admin/seo/page.tsx` (tabs: Overview ·
  Recommendations · Base · Fix-it) — NOT a separate nav item. Pages using a code default
  show grey (`muted`), not red. The Base auto-fix is the one place meta is filled
  automatically (missing meta is strictly worse than AI meta); the **Fix-it tab** is now
  only Hermes' strategic Rebuild plan (approve-first), not gap-filling.
- **Hermes invariant:** a run must never propose NEW content for a query it also
  flags as cannibalised (a third page splits the signal further). `hermes.js`
  enforces it after assembling both lists — `kind:'content'` plays whose `target`
  matches a surfaced cannibalisation block are held and reported on that block;
  `kind:'meta'` plays pass (they sharpen an existing page, adding no URL).

## One-owner invariants (the anti-drift rules)
The recurring bug in this codebase is **duplicated truth** — the same fact copied
into several files, then drifting. Each fix is the same shape: one owner + a guard.
- **Shipping rates/thresholds:** `backend/services/shipping.js` (admin-overridable)
  is the ONLY source, served publicly by `/api/shipping`. The storefront reads it —
  `lib/shippingSchema.ts` (Product JSON-LD) and `lib/useFreeShipping.ts` (cart bar,
  PDP copy). Never hardcode `150`. It had drifted: JSON-LD told Google free shipping
  at €250/€200/€300 while checkout gave it at €150 — a merchant-listing mismatch.
- **Site origin (backend):** `backend/config/site.js` — `SITE_URL` / `siteUrl(path)`.
  Env-driven (`FRONTEND_URL`), normalised: trailing slash stripped and apex→www so
  nothing links through the 301. It was written 14 times in two forms; customer
  emails used the apex (an extra redirect hop) and two email links ignored the env
  var entirely, so a staging deploy would have linked to production.
- **Site origin (frontend):** `lib/brand.ts` (`brand.url`) is the ONLY place the domain is written.
  `lib/i18n.ts` re-exports it as `SITE`; sitemap/robots/feed/Breadcrumbs/layout read it.
  For anything locale-aware use `localeUrl(locale, path)` — a literal
  `https://www.silkilinen.com/...` in a canonical silently breaks the `/de|/fr|/it|/es`
  versions (it did: `/de/shop?new=true` was canonicalising to the English URL).
- **Colour:** brand tokens only (see Conventions) — never hardcode hex on the storefront.
- **Banner/announcement copy:** the CMS (`banner_message_1..4`); code defaults are a
  fallback only.
- **Slugs:** normalised in the MODEL's `pre('save')` (`utils/slug.js` `slugify`), never
  trusted from `req.body`. `Product`/`Collection` slugify + keep `previousSlugs` (old URL
  301s; public routes fall back to it, storefront `permanentRedirect`s to canonical).
  `Category` normalises only on new/changed slugs and has NO `previousSlugs` — its slug is
  the string on `Product.category`, so re-slugging orphans products; use
  `scripts/consolidateCategories.js`. **Never `findByIdAndUpdate` a slug** — it skips
  `pre('save')`, which is how `/collections/a%20curated%20edit%20of%20silk%20robe,…`
  shipped. Repair: `scripts/fixCollectionSlugs.js` (dry-run default, `--apply`).
- **Bottom-edge clearance:** `--cookie-bar-h` (globals.css) — the consent bar is fixed to
  `bottom:0`; anything else pinned there (ContactWidget, FloatingCartBar) adds this to its
  own offset. 0 when the bar is hidden. Never hardcode the bar's height.
- **CSV cells:** `backend/utils/csv.js` (`csvCell`/`csvRow`). Five routes hand-rolled
  quote-doubling and none neutralised formula injection — exported names/phones come
  from checkout, so `=HYPERLINK(...)` in a name executes when the founder opens the
  export. Never build a CSV cell inline.
- **Fixed-header clearance:** `--announcement-h` + `--nav-h` (globals.css); `.shopContent`
  is their sum. The layouts set `data-bar="on|off"` because the announcement bar is
  conditional (absent when the CMS is unreachable) — a single hardcoded total left a gap.
- **Funnel:** `backend/services/funnel.js` — `getFunnel()` is the ONE funnel (60s memo,
  5 callers: dashboard panel, clickstream brief, analyst tool, advisor, agents).
  `clickstream.js` delegates to it; it used to run a second, slightly different one.
  Gates: `MIN_SEGMENT` 8 sessions to name a segment, `SHIFT_POINTS` 10 to report a
  week-over-week move. **Silence means "not enough data", never "no problem"** — say so
  in any surface that renders it, or agents read absence as health.
- **Selling loop (added this session):** on-site search is recorded WITH its result
  count (`components/SearchTracker.tsx`) — zero-result searches are surfaced as unmet
  demand in the advisor + agents, and product search matches name/description/category/
  colours/colorName/sizes/material so "sky blue" finds the piece. Back-in-stock waitlist:
  `models/StockNotification` + `routes/stockNotify.js` + `services/stockNotify.js`
  (hourly sweep, claims the row BEFORE sending). Checkout email persists on BLUR, not at
  submit, or cart recovery can only reach people who already paid.
- **Funnel self-check:** `findBlindSpots()` flags a stage whose event has NEVER been
  recorded while the previous stage has traffic — an uninstrumented stage is
  indistinguishable from "nobody got there", and both `search` and `add_to_cart`'s
  `productId` were silently missing. Event `productId` is a TOP-LEVEL field; putting it
  in `props` makes it invisible to every aggregation.
- **Advisor ranking:** priority band first, then named-cause categories (Demand,
  Conversion) ahead of housekeeping; the weekly digest takes the top 3 and states how
  many it held back. Tests in `tests/advisorRank.test.js`.
- **Order status:** `STATUS_TRANSITIONS` in `routes/orders.js` — the enum only ever
  validated that a status EXISTS. Illegal moves 409 with the valid next steps; `force`
  allows a genuine correction and stamps it into `statusHistory`. Tests in
  `tests/orderTransitions.test.js`.
- **Discounts:** `PromoCode.value` is `min: 0` AND clamped again in `services/discounts.js`
  (percent ≤100, fixed ≤subtotal, never negative). A negative value made
  `subtotal - discountAmount` LARGER than the cart — a typo became an overcharge.
- **Reviews:** the storefront shows every APPROVED review at any rating, and the average
  is computed from all of them. Filtering to 4★+ made the average incapable of dropping
  below 4.0 while feeding `aggregateRating` to Google — against their snippet policy and
  the EU Omnibus/UK DMCC rules on selective presentation. Moderate spam, never ratings.
- **Sold-out products:** `DETAIL_FILTER` (products.js) allows `sold_out` so the PAGE
  survives; `PUBLIC_FILTER` keeps listings buyable-only. `Product.pre('save')` flips
  status at zero stock, so filtering detail on `active` 404'd the shop's best pieces
  while `sitemap.ts` still listed them, and made the back-in-stock waitlist unreachable.
- **Cart persistence:** the localStorage writer waits on a `hydrated` ref — effects run in
  declaration order after one commit, so the writer fired with the EMPTY initial cart
  before the reader's update landed and overwrote a real saved basket.
- **NEW badge:** the manual `isNewArrival` flag only, on BOTH card and PDP. A time-based
  fallback on an ISR-cached page freezes at snapshot time and then lies.
- **Product names:** `backend/utils/productName.js` — `Silk [garment] in [Colour]`,
  sentence case, no brand prefix. The admin form calls `/api/admin/products/name-check`
  (never blocks, just suggests); `scripts/renameProducts.js` writes a plan file you edit
  before `--apply`, and re-cuts the slug in the same pass (`previousSlugs` 301s the old URL).
- **GDPR erasure:** `DELETE /api/admin/customers/:id/gdpr` must purge every store holding
  the address — Customer (anonymise), Cart (blank + unsubscribe), Newsletter and
  StockNotification (delete). Orders are RETAINED (financial record). Miss one and cart
  recovery or the restock sweep keeps emailing someone who asked to be deleted.
- **Marketing email:** every marketing message needs an opt-out (GDPR Art. 21, PECR).
  `utils/unsubscribeSign.js` signs the link; pass a `scope` so a link minted for one
  purpose can't be replayed against another. Transactional mail is exempt.
- **Server fetches:** storefront server components use `lib/apiFetch.ts` (4s timeout).
  A bare `fetch` in a server component holds the render until Vercel's function timeout.
  Use `apiListResult` where an outage must not read as an empty catalogue.
- **Listings vs detail:** `CARD_PROJECTION` (products.js) serves grids; `?full=true` for
  the whole document. Listings used to ship full descriptions, so payload grew with the
  copywriting rather than the product count.
- **Rates:** `getRates()` backs off to one attempt/min on provider failure and KEEPS a
  stale cache — it is awaited by `/quote` and `/create-intent`, so retrying per request
  put a 6s timeout in front of every checkout.
- **Style Finder question count:** `lib/styleFinder.ts`. The homepage band can't import
  `QUESTIONS` (bundle cost), so `StyleFinder.tsx` asserts `QUESTIONS.length` against it in
  dev. Add a question → update `QUESTION_COUNT`.

## SEO invariants
- **URLs have ONE owner: `frontend/lib/urls.ts`** (`productPath`/`productHref`,
  collection/category equivalents). Never hand-build `/product/${…}` — an ESLint
  `no-restricted-syntax` rule fails the build if you do (admin-only preview links
  are explicitly exempted inline). Root cause it fixes: links were built in six
  places three different ways, and the PDP colour swatches used the raw ObjectId,
  so Google indexed `/product/<ObjectId>` alongside the slug URL — two URLs for one
  page. The API now serves each `colorVariants[]` sibling's slug so swatches are
  canonical at the source.
- Self-referencing `alternates.canonical` on indexable pages. Empty/stale category slugs
  `notFound()` + noindex (see `shop/page.tsx`). Meta descriptions run through `clampMeta`.
- Product JSON-LD on PDP (offers EUR-canonical, aggregateRating from product-linked reviews).
  Organization + WebSite JSON-LD in `app/layout.tsx`. Cloudinary preconnect in `<head>`.

## Guards (build fails if broken)
- `no-restricted-syntax` — hand-built `/product/` URLs (whole repo, error); hex + colour
  keywords under `app/admin` (error; `Zone2Metrics.tsx` exempt for Recharts).
  **ESLint flat config REPLACES a rule's options rather than merging them** — a block that
  declares one selector silently disables the others for those files, and one severity
  applies to the whole rule. Restate every selector in each block.
- `jsx-a11y/label-has-associated-control` — error on `app/(shop)`/`components`
  (`assert:'either'`, so a label wrapping its input counts); warn elsewhere (admin has ~130).
- Error boundaries: `(shop)/error.tsx`, `admin/error.tsx`, `global-error.tsx` (root layout
  failures — ships its own html/body and literal colours; there is no layout left).
- Rate limits: global 300/min on `/api` (`middleware/rateLimiters.js` `globalLimit`),
  checkout 20/5min, AI 20/hr. Health checks skipped.
- `process.on('unhandledRejection'|'uncaughtException')` in `server.js` — log before dying,
  or a repeating fault looks like random Railway restarts.

## Conventions
- **Admin colour:** `--admin-*` tokens (globals.css) — its own quieter workspace
  palette (white cards on `--admin-bg`, brand ink) with a CLOSED status set: one
  `--admin-success`/`-danger`/`-warning`/`-info`, each with a `-soft` tint. It had
  grown 190 literals — 10 reds, 11 greens, 5 ambers — so "is this bad?" had to be
  re-learned per screen. An ESLint rule fails the build on any hex under
  `app/admin`; `_components/dashboard/Zone2Metrics.tsx` is the one exemption
  (Recharts takes literal colours into SVG attributes).
- **Colour: use the brand tokens, never hardcode hex on the storefront.** `globals.css` :root
  defines 7 core (`--color-bg/-surface/-surface-warm/-line/-ink-muted/-ink/-accent`, aliased
  `--warm-white/-cream/-border/-muted/-dark/-rose`) + semantic `--color-success/-danger/-gold`
  (+ `-soft`/`-bright`). Don't write `var(--tok, #hex)` fallbacks (the token is always defined).
- Match existing style; surgical diffs (see root CLAUDE.md). Fail-loud in agents, fail-soft per item.
- Prefer live DB data over hardcoded lists. Keep the EUR path untouched when touching currency.
- Lint note: `react-hooks/set-state-in-effect` warnings on `useEffect(()=>{load()})` are
  pre-existing across admin pages — not your regressions.
