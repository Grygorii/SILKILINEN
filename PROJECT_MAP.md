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
- **`computeTotals()` in `backend/services/orderTotals.js` is the ONE order arithmetic**
  (sale-vs-code, the non-negative clamp, shipping on the DISCOUNTED subtotal, tax reported
  but NOT added since EU prices are VAT-inclusive). It was written FOUR times — `priceOrder`,
  the intent-update path, the webhook that writes the Order document, and `routes/cart.js`
  — so the totals SHOWN could drift from the totals CHARGED, which is the one drift this
  file cannot afford. All four now call it; `tests/orderTotals.test.js` pins the invariants
  that cost money if inverted (a winning sale must NOT consume a single-use code; a code
  wins an exact tie; a discount can never raise the total, even if negative; a discount
  dropping the order under the free-shipping threshold reinstates the fee). In the webhook
  the Stripe METADATA still wins where present — that document is the financial record and
  must describe the charge, not recompute an opinion of it.
  ⚠️ Known divergence: `cart.js` applies only `cart.discountAmount` and knows nothing about
  collection sales, so a basket holding a discounted-collection product can show a HIGHER
  total in the cart than at checkout. Customer's favour today; fixing it means loading
  products + collections on every cart read.
- **Collection sales:** `discountedCollectionMap()` loads every active discounted collection
  ONCE per priced order; `bestCollectionDiscount(ids, map)` is the pure per-product rule
  (biggest wins; a product can sit in several). It used to be one `Collection.find()` per
  cart LINE, awaited in the loop, on the two endpoints in front of "Continue to payment".
  The map is keyed by `String(_id)` — `product.collections` holds ObjectIds, so an identity
  lookup silently returns 0 and stops applying every sale in the shop.
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
- **components/** — incl. `inline/InlineEdit.tsx` (WYSIWYG `?edit=1`), `Price.tsx`, `FabricCare.tsx`,
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
- **Search-engine scope is DECLARED, not guessed:** `services/seoIntel.js`
  `serpStatus()` is the ONE description of what `GOOGLE_CSE_ID` points at, read
  by the health check and Connections. A Programmable Search Engine searches only
  its site list unless created with "Search the entire web" — two instruments,
  one API, and the API never says which. Ours is a curated ~40-site set
  (silkilinen.com + La Perla, Eberjey, Lunya, Olivia von Halle) and Google no
  longer offers the whole-web option on new engines for this account, so this is
  permanent. `serpAnalysis()` therefore returns NOTHING unless
  `GOOGLE_CSE_SCOPE=web` is explicitly set (default `sites`); an all-ours result
  set is refused as a backstop for a wrong declaration. `curatedSearch()` keeps
  the site list available to anything wanting competitors rather than rankings.
  Read as a SERP, five boutiques look like a soft page one and Hermes calls a
  fight winnable that John Lewis owns — wrong, confident and invisible, where no
  SERP is a visible gap Hermes reasons through openly.

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
- **Origin claims:** `backend/utils/originClaims.js` — `findOriginClaims(text)` is the ONE
  rule for what may be said about where things are made (ADR 0008/0009). Origin is MIXED
  and per-product, so a blanket "Made in Ireland" is a false REGULATED claim, not just
  off-brand. Brand-level truth ("An Irish silk & linen brand, based in Donegal") is
  scrubbed by an ALLOWED list before the banned patterns run, or the one sentence the
  brand is supposed to use trips the "Irish silk" rule. `tests/originClaims.test.js`
  scans human-authored copy in `frontend/app/(shop)`, `frontend/components`,
  `backend/scripts` and `seed.js` on every CI run — `backend/services` is skipped because
  the agent prompts quote the phrases in order to forbid them. Comments are stripped
  (`{code:true}`): a comment cannot reach a customer. ⚠️ The scan covers CODE ONLY; the
  live copy is in MongoDB — `scripts/auditCopyClaims.js` reports those, read-only, and a
  human rewrites each. Prose alone already failed once: 0008 was implemented in June and
  the claims were back by August.
- **Banner/announcement copy:** the CMS (`banner_message_1..4`); code defaults are a
  fallback only.
- **CMS copy has THREE writers and no owner:** `seedSiteContent.js` (fresh DB only — it
  skips existing keys, so editing it changes nothing live), `fixOriginContent.js` (the ONLY
  one that rewrites live values; run it on the Railway shell), and the component's own
  `val(content, key, default)` fallback (renders when the API is down). The frontend can't
  require the backend, so there is no single owner — `tests/siteCopySync.test.js` asserts
  the three agree instead. `fixOriginContent.js` claimed in a comment to mirror the seed
  and was missing `homepage_hero_title` outright.
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
  own offset. 0 when the bar is hidden. Never hardcode the bar's height. Same contract:
  `--sticky-buy-h` (the PDP buy bar) and `--contact-widget-h` (`-inset` + `-size`, the
  contact bubble). The bubble is the odd one — a fixed CORNER, not a bar — so it covers
  what the PAGE puts in that corner: the mobile hero bottom-aligns its CTA and cleared it
  with a hand-measured 56px against a 74px footprint. The hero now reads the token and
  adds `--cookie-bar-h` **at the point of use**: a custom property is substituted where
  it is DECLARED, so folding a body-level token into a `:root` one silently freezes it.
  `frontend/tests/floatingUtilities.test.ts` asserts every declared clearance token has a
  reader outside globals.css — declared-but-unread is what `--sticky-buy-h` was for months.
  Mobile hero height is `100svh` (not `vh`, which is the URL-bar-hidden height and put the
  CTA below the fold on load; not `dvh`, which resizes the hero as the bar moves).
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
- **Shop listing order:** `backend/utils/productSort.js` `sortSpec(value)` is the ONE
  whitelist (`featured`/`newest`/`price-asc`/`price-desc`, plus legacy `-createdAt` which
  `NewArrivals` still links with). The route held a single `if (sort === '-createdAt')`,
  so every other value fell through to Mongo's NATURAL order — "price low to high" would
  have returned insertion order and looked like it worked. Unknown values fall back rather
  than 400 (a hand-edited URL should still return the shop) and never reach Mongo's sort
  spec. `components/SortLinks.tsx` owns the LABELS; `tests/productSort.test.js` asserts
  every key it offers exists in the whitelist, since a missing one fails silently.
- **Shop URLs:** `frontend/lib/urls.ts` `shopPath({category,q,isNew,sort})` — one builder,
  fixed param order, defaults omitted (`/shop`, never `/shop?sort=featured`). Controls must
  PRESERVE each other: a sort link dropping `?category` lands the shopper back in the full
  catalogue. Uses `encodeURIComponent`, NOT `URLSearchParams` — the latter writes a space
  as `+`, and this backs `categoryPath`, whose output goes into canonicals already indexed.
  Sorted URLs canonicalise to the unsorted page because `generateMetadata` builds the
  canonical from category/q/new and ignores `sort`.
- **`ProductGrid` is a SERVER component.** It used to fetch `/api/categories` in an effect
  and navigate with `router.push`: the page already had the list (so a category view
  fetched it twice), `/shop` rendered the row only after hydration (layout shift), buttons
  gave the six category pages no crawlable link from the shop, and the pushed path had no
  locale — so every filter on `/de/shop` dropped the visitor into the English shop.
  Categories now arrive as a prop; the row is anchors from `categoryHref`.
- **Product search:** `backend/utils/productSearch.js` — `buildSearchFilter(q)` is the ONE
  rule (fields, escaping, word handling), called by `routes/products.js` and imported by
  `tests/productSearch.test.js` (it used to mirror a copy, which is how the bug below
  survived a test file whose stated job was pinning it). EVERY WORD must match but each
  may match a DIFFERENT field: the old filter regexed the whole phrase per field, so
  "sky blue robe" returned an empty page for a robe whose `colorName` is Sky Blue — and
  that empty page then reached the advisor as unmet demand. Blank/whitespace `q` returns
  `null` (Mongo rejects `{$and:[]}`); a single word behaves as before.
- **Opportunities (the Growth Engine's list):** `services/opportunities.js` fetches,
  `utils/demandFit.js` decides. Every real query is joined to the shelf and becomes ONE
  of six proposals, because identical numbers demand opposite actions: `restock` (matched,
  out of stock — outranks everything, and counts the `StockNotification` waitlist),
  `range` (nothing matches — stock it, or we name it wrong), `depth` (ranks, nearly out,
  AND selling), `convert` (clicked, in stock, never sold — the page kills the sale),
  `rank` (past page one), `title` (page one, no clicks). Silent on a query that is simply
  working, and on anything under the floor. Matching uses `buildSearchFilter` — the SAME
  rule the storefront search box uses — or the list invents range gaps out of search
  misses. Surfaced at `/api/admin/growth/opportunities`, in `OpportunitiesPanel` (leads
  the Growth Engine page), and the top 3 enter the advisor, which is what carries them
  into the weekly digest.
  ⚠️ `convert` is gated on `shopSells`: with no orders at all EVERY product has sold
  nothing, and firing on all of them would bury the real problem (nobody is arriving)
  under a dozen false diagnoses. Default is the safe reading.
- **Two demand sources, one list:** on-site searches (`clickstream.unmetSearches`) are
  folded in alongside Google's, tagged `source:'site'`, and held to a LOWER floor
  (`MIN_SITE_SEARCHES` 2 vs `MIN_IMPRESSIONS` 5) — someone typing in the shop's own box
  has already arrived and named what they want, where an impression only means the shop
  appeared on a page nobody read. A site search that MATCHES a live in-stock product says
  nothing (position/CTR are meaningless off-Google, and running those branches produced
  "on page one and nobody clicks it" about a search that never touched Google).
  Search Console is OPTIONAL — first-party demand must not depend on Google being wired up.
- **Deploy skew is a real state:** Vercel and Railway deploy independently from master, so
  the frontend is routinely newer than the API. A panel must degrade to NO verdict, never
  to a wrong one — the country row defaulting a missing `band` to `watch` would have
  labelled every market "too small to judge" purely from deploy timing.
- **Unmet demand is re-verified:** `clickstream.js` re-runs every recorded zero-result
  search against the live catalogue with `buildSearchFilter`, splitting `unmetSearches`
  (found nothing then AND now — real gaps) from `nowFindable` (failed then, works now).
  Without it the advisor recommends stocking products already on the shelf, because a
  logged miss outlives whatever caused it. `nowFindable` is Conversion, not Demand — sales
  lost to the search box, nothing to stock — and the agent brief says so explicitly, since
  an LLM handed "searched but found nothing" will recommend buying stock every time.
- **Analytics exclusion:** `frontend/lib/analyticsExclude.ts` — `isExcludedFromAnalytics(
  pathname, search)` is the ONE rule for what is the founder working rather than a
  customer shopping, read by BOTH trackers (`lib/track.ts` and `components/
  VercelAnalytics.tsx`). They had drifted: Vercel dropped the preview surfaces and our own
  beacon did not, so founder previews polluted the clickstream that feeds the funnel and
  advisor. Covers `/admin`, `/journal/preview`, `/preview/`, and **`?edit=1`** (InlineEdit
  turns the real storefront into a work surface — the path looks like shopping). Strips a
  leading locale, reading `LOCALES`, so `/de/...` can't reopen the hole.
- **Two visitor counts, one guard:** `backend/services/vercelAnalytics.js` reads Vercel Web
  Analytics (`/v1/query/web-analytics/...`, env-gated on `VERCEL_API_TOKEN` +
  `VERCEL_PROJECT_ID`, cached 15min, stale-on-failure, error NOT cached). Route
  `/api/admin/vercel-analytics`. It names four states and never collapses them —
  unconfigured / `enabled:false` / figures / error — because "Web Analytics was never
  switched on" returning `0 visitors` reads as a dead shop. ⚠️ **Web Analytics is not
  enabled on the Vercel project** (API 404s `not_found`), so it has recorded nothing.
  `agreementVerdict()` compares it with our own `Visit` count (thresholds `AGREEMENT`,
  `MIN_SAMPLE` 20): ours silent while Vercel sees people is CRITICAL, since the funnel,
  advisor and every agent read ours. Surfaced as the `analytics_agreement` health check.
- **"Nobody is visiting" is a recommendation:** `advisor.js` `trafficRec(traffic)` — with
  no traffic every other item is polish, so the list used to lead with meta descriptions
  for a shop nobody had opened. Vercel's independent count decides between "no visitors"
  (Demand — pick one channel) and "no visitor TRACKING" (Fixes — never mentions channels,
  asserted by test, since sending the founder to buy distribution for traffic they already
  have is the worse error).
- **Funnel self-check:** `findBlindSpots()` flags a stage whose event has NEVER been
  recorded while the previous stage has traffic — an uninstrumented stage is
  indistinguishable from "nobody got there", and both `search` and `add_to_cart`'s
  `productId` were silently missing. Event `productId` is a TOP-LEVEL field; putting it
  in `props` makes it invisible to every aggregation.
- **Advisor ranking:** priority band first, then named-cause categories (Demand,
  Conversion) ahead of housekeeping; the weekly digest takes the top 3 and states how
  many it held back. `AdvisorPanel` shows the top 5 and COUNTS the rest behind a toggle —
  it used to render all ~15, so the ranking bought nothing, and a silently truncated list
  is indistinguishable from a genuinely short one. Tests in `tests/advisorRank.test.js`.
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
  **`GET /api/reviews/summary` is the ONE aggregate** (average/count/distribution over
  approved reviews; `?productId` scopes it). Read by the homepage strip, the Organization
  JSON-LD in `app/layout.tsx`, `ProductReviews` and `/reviews` — which used to compute its
  own from the list endpoint and agreed only because `/api/reviews` with no query params
  falls into an UNPAGINATED branch (`!page && !limit && sort==='recent' && !productId`).
  Add a default limit and that page's headline silently becomes the mean of the ten most
  recent while the structured data keeps asserting the real figure.
  `frontend/tests/reviewAggregate.test.ts` fails on any storefront file deriving an
  average from `starRating`. Homepage strip shows `MAX_REVIEWS` (3, owned by
  `ReviewsCarousel`, imported by the caller) as a static row — the marquee duplicated its
  own contents to have something to scroll and showed 1-2-3-1-2-3 at that length.
- **PDP right rail order (§22):** name, rating, price, material, colour, size, add to bag.
  **Colour has ONE owner: `ProductOptions`.** It was stated twice — a `COLOUR` cube row
  above the price in `product/[id]/page.tsx` AND the labelled swatch group inside
  ProductOptions — because there are two different things called colour: the record's
  `colours` array is a CHOICE that goes in the cart line, `colorVariants` are separate
  PRODUCTS (own stock, own URL) so picking one is NAVIGATION. Both are real; neither
  needed its own heading. Now one block: swatches only when `colours.length > 1`, else a
  `Colour · <name>` fact row (same shape as size and fit — a picker with one option is
  not a choice), plus outlined links to the siblings. The rating line reads the SAME
  `/api/reviews/summary?productId=` the JSON-LD does, so the page cannot show one figure
  and assert another; silent at zero reviews rather than printing empty stars.
  ⚠️ The trust row must stay honourable: `UKShipBadge` already tells GB visitors "Ships
  from the UK", so a "Shipped from Ireland" line would contradict it two lines apart.
  "Gift-ready packaging" is safe — `/gift-wrapping`, the FAQ and `ReassuranceRow` all
  state it is included at no cost.
- **Card colour line:** `frontend/lib/productColour.ts` `cardColour()` — prints the colour
  under the product name ONLY when the name doesn't already contain it. The canonical name
  is `Silk [garment] in [Colour]` (`utils/productName.js`), so an unconditional colour line
  restates it; the catalogue is mid-rename, so both cases are live. Silent on a record
  holding several colours (one line would misdescribe the rest) and on placeholders.
- **Sold-out products:** `DETAIL_FILTER` (products.js) allows `sold_out` so the PAGE
  survives; `PUBLIC_FILTER` keeps listings buyable-only. `Product.pre('save')` flips
  status at zero stock, so filtering detail on `active` 404'd the shop's best pieces
  while `sitemap.ts` still listed them, and made the back-in-stock waitlist unreachable.
- **Quantity ceiling:** `frontend/lib/variantStock.ts` — `maxOrderable(stockBySize(variants),
  selectedSize, total)`. The stepper capped at `Math.min(stock ?? 10, 10)` where `stock` is
  the product TOTAL, so a robe with 9 Large and 1 Medium offered five Mediums. ⚠️ Nothing
  downstream catches it: `checkoutV2` never checks availability before charging and
  decrements AFTER the order commits, fail-soft, so this cap is the ONLY guard against an
  unfillable order. Held by BOTH `ProductOptions` and `QuickAddSheet` (each had its own
  copy of the arithmetic), and each clamps `qty` down when the size changes — otherwise a
  basket built as 5×L silently becomes 5×M. No variant rows means stock is UNTRACKED, not
  sold out, so those keep the total-based cap. **Still open:** a server-side stock check
  before the payment intent; a frontend cap is advisory only.
- **Back-in-stock waitlist form:** `components/NotifyWhenBack.tsx` is the ONE owner, used
  by the desktop panel AND the mobile `StickyBuyBar`. The form was inline in
  `ProductOptions`, so the sticky bar — the only CTA a phone shows — still fired the
  `mailto:` the waitlist was built to replace (dead without a mail client; unwatched inbox
  when it works). The shop's clearest buying signal was captured on desktop, dropped on mobile.
- **Cart persistence:** the localStorage writer waits on a `hydrated` ref — effects run in
  declaration order after one commit, so the writer fired with the EMPTY initial cart
  before the reader's update landed and overwrote a real saved basket.
- **NEW badge:** the manual `isNewArrival` flag only, on BOTH card and PDP. A time-based
  fallback on an ISR-cached page freezes at snapshot time and then lies.
- **Fabric & care (PDP):** `frontend/lib/fabricCare.ts` — `careSteps()`, `mommeReading()`,
  `hasFabricDetail()`; rendered by `components/FabricCare.tsx` inside the "Fabric & care"
  accordion, with the momme on the CLOSED row via `AccordionItem meta`. **Momme is never
  invented** — it is a per-product measurement that also feeds the Merchant `material`
  field, so an empty field shows no weight rather than a plausible default; a weight
  written into `materialComposition` is read only where a number sits against the unit
  (`19mm`/`momme`), because a bare first-number grab reads "95% Silk 5% Elastane" as 95
  momme. Care free text is split per instruction and **no instruction is ever dropped** —
  an unclassified phrase gets a neutral marker, since a lost "do not tumble dry" ruins the
  garment. Icons are ISO 3758 CATEGORY markers, not claims: "Iron on low" and "Do not
  iron" share a glyph and the text says which, so nothing has to parse negation. A general
  silk/linen care list stands in when the founder wrote none, gated on the composition
  naming a fabric and flagged `general` so the page says whose instruction it is.
  Pinned by `tests/fabricCare.test.ts`.
- **Product names:** `backend/utils/productName.js` — `Silk [garment] in [Colour]`,
  sentence case, no brand prefix. The admin form calls `/api/admin/products/name-check`
  (never blocks, just suggests); `scripts/renameProducts.js` writes a plan file you edit
  before `--apply`, and re-cuts the slug in the same pass (`previousSlugs` 301s the old URL).
- **Category fit:** `backend/utils/categoryFit.js` — `misfiledCategory(name, category,
  knownSlugs)` is the ONE garment→category rule, called by `advisor.js` and pinned by
  `tests/categoryFit.test.js` (which imports it — it used to define its own copy, so it
  passed while no such rule existed in production at all). A category is repeated in the
  breadcrumb, the shop filter and the feed's `product_type`, so one wrong value is wrong
  three times. Deliberately conservative: silent on garments with no entry, on ones that
  fit two categories, on a product with no category, and — via `knownSlugs` — on a move
  into a category the shop no longer has. Ambiguous garment words (`shirt`, `shorts`) are
  absent on purpose. Acted on by `scripts/refileCategories.js` (plan file → edit →
  `--apply`, same discipline as `renameProducts.js`); it re-reads live categories on apply
  and skips a row whose product was refiled by hand in between. Slugs are NOT touched —
  category isn't in the product URL, so refiling costs no ranking and needs no redirect.
- **Canonical categories:** `config/categories.js` lists the SIX consolidated slugs
  (`robes`/`sleepwear`/`lingerie`/`lounge`/`home`/`scarves`) — it had kept the nine
  pre-merge ones, so `migrateCategories.js` called live categories non-canonical and
  merged-away ones canonical. `Product.category`'s default is the NAMED `DEFAULT_CATEGORY`,
  never `SLUGS[0]`: a positional default meant reordering the list for display silently
  changed the category of every product created afterwards, in three customer-facing places
  at once. Retired slugs are deliberately absent — they 301 via `RETIRED_CATEGORIES` in the
  shop route. `tests/categoryConfig.test.js` guards it, including that every category
  `GARMENT_CATEGORY` targets actually exists (a merge landing on one side only is what
  broke it). Still open: whether a product should default to a category at all.
- **GDPR erasure:** `DELETE /api/admin/customers/:id/gdpr` must purge every store holding
  the address — Customer (anonymise), Cart (blank + unsubscribe), Newsletter and
  StockNotification (delete). Orders are RETAINED (financial record). Miss one and cart
  recovery or the restock sweep keeps emailing someone who asked to be deleted.
- **UK shipping claim:** `frontend/lib/ukShipping.ts` — the copy AND the show/hide rule.
  Dispatch is **Derry for UK orders, Donegal for everywhere else**, so every line is
  scoped (`UK orders ship from Derry…`): unscoped, it is a false claim about the shop.
  It was written five ways (banner, notice card, badge, two `/shipping` paragraphs) and
  only the two on `/shipping` — the page nobody opens — named the town, which is the
  detail that makes the promise checkable rather than a brand asking to be believed.
  `shouldShowUkShipping(isUK, decided)` **fails OPEN**: `useIsUK()` returns null for
  "unknown", and unknown covers a failed `/api/geo`, a stripped header, and any deploy
  not behind Vercel's edge — the old `isUK === true` gate hid the answer to "will I pay
  customs?" from the customer asking it. Scoped copy is what makes that safe. `useUkShipping()`
  adds a 1.2s grace so a working lookup wins the race and non-UK visitors see no flash.
  ⚠️ Asymmetric on purpose: badge + banner fail open, `UKShippingNotice` stays strictly
  `isUK === true` — fail open on a whisper, never on a dialog that must be dismissed.
  Also fixed at source: `/api/geo` returning `{country:null}` used to classify as `false`
  (a confident "not the UK"), not null. Surfaces: announcement bar, PDP, **cart drawer**
  (added — "Shipping: calculated at checkout" is where the customs fear lands), checkout.
  `tests/ukShipping.test.ts` pins the gate and fails any file promising no customs without
  naming Derry (comments stripped, same reasoning as `originClaims`).
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
  `no-restricted-syntax` rule fails CI if you do, via `npm run lint:invariants` and NOT
  via `next build` (admin-only preview links are explicitly exempted inline). Pinned by
  `frontend/tests/urls.test.ts`: the rule guarded callers while nothing checked the owner. Root cause it fixes: links were built in six
  places three different ways, and the PDP colour swatches used the raw ObjectId,
  so Google indexed `/product/<ObjectId>` alongside the slug URL — two URLs for one
  page. The API now serves each `colorVariants[]` sibling's slug so swatches are
  canonical at the source.
- Self-referencing `alternates.canonical` on indexable pages. Empty/stale category slugs
  `notFound()` + noindex (see `shop/page.tsx`). Meta descriptions run through `clampMeta`.
- Product JSON-LD on PDP (offers EUR-canonical, aggregateRating from product-linked reviews).
  Organization + WebSite JSON-LD in `app/layout.tsx`. Cloudinary preconnect in `<head>`.

## Guards — what actually enforces them
**`next build` does NOT run ESLint** (Next 16 dropped it), so every rule below was
advisory for as long as it existed, and this section used to be headed "build fails if
broken". What enforces them now is **`.github/workflows/ci.yml`** (push to master + every
PR): backend `npm test`, frontend `npm test`, `tsc --noEmit`, `npm run lint:invariants`
(BLOCKING), the full lint (ADVISORY), then `next build`.
- **`npm run lint:invariants`** (`frontend/scripts/lint-invariants.mjs`) is the blocking
  one, and covers `no-restricted-syntax` only — the two rules that are invariants rather
  than style. The full `npm run lint` reports **113 pre-existing errors** (78
  `react-hooks/set-state-in-effect` across admin pages, 16 unescaped entities, 13 html
  links) so it cannot block without a refactor nobody asked for. Clear that backlog →
  delete the script and make `npm run lint` blocking.
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
- Lint note: `react-hooks/set-state-in-effect` on `useEffect(()=>{load()})` is pre-existing
  across admin pages — not your regressions. They are **errors, not warnings** (78 of
  them), which is why the full lint is advisory in CI; see the Guards section.
- **Tests:** `backend/` 131 pure + 14 that need MongoDB (`tests/mongo.js` SKIPS them, loudly
  on stderr, when the mongod binary can't be downloaded — set `MONGODB_TEST_URI` to run
  them; a supplied-but-broken URI FAILS rather than skipping). `frontend/` has vitest too
  (`npm test`, config `vitest.config.mts`, node env, no jsdom — the risky parts are pure
  functions in `lib/`). Both run in CI.
