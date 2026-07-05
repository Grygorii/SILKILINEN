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
- **app/admin/** — admin console, one folder per agent/feature. `layout.tsx` = AdminLayout.
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

## SEO invariants
- Self-referencing `alternates.canonical` on indexable pages. Empty/stale category slugs
  `notFound()` + noindex (see `shop/page.tsx`). Meta descriptions run through `clampMeta`.
- Product JSON-LD on PDP (offers EUR-canonical, aggregateRating from product-linked reviews).
  Organization + WebSite JSON-LD in `app/layout.tsx`. Cloudinary preconnect in `<head>`.

## Conventions
- Match existing style; surgical diffs (see root CLAUDE.md). Fail-loud in agents, fail-soft per item.
- Prefer live DB data over hardcoded lists. Keep the EUR path untouched when touching currency.
- Lint note: `react-hooks/set-state-in-effect` warnings on `useEffect(()=>{load()})` are
  pre-existing across admin pages — not your regressions.
