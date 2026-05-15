# SILKILINEN Changelog

## 2026-05-15 — Product page polish (7 improvements for soft launch)

**What changed:**

- **Multi-image gallery with thumbnail strip (Sections 1+2)** — `ProductGallery` fully rewritten. Desktop: vertical 88px thumbnail strip on the left, main image on the right. All product images and video appear as thumbnails. Click any thumbnail to display in the main area. Mobile: full-width image with page dots and native touch swipe (no library dependency — native `onTouchStart`/`onTouchEnd` with 40px threshold). `isPrimary` image always first, then sorted by `order` field.
- **Video display on product pages (Section 2)** — `product.productVideo` is now passed from `page.tsx` to `ProductGallery`. Video appears as the last thumbnail with a play-icon overlay derived from Cloudinary's `so_0,f_jpg` still-frame transformation. Main area renders a `<video>` element with `controls`, `playsInline`, `preload="none"`. Video pauses automatically when navigating to a different thumbnail. No autoplay.
- **"One Size" auto-select (Section 3)** — `ProductOptions` initialises `selectedSize` via lazy `useState(() => sizes.length === 1 ? sizes[0] : '')`. Single-size products skip the "PLEASE SELECT A SIZE" gate; "ADD TO BAG" is active on page load. Multi-size products unchanged.
- **Story sentence above price (Section 4)** — `getStorySnippet()` helper extracts the first ~180 characters of `product.description` (sentence-boundary aware). Shown in italic muted text between the material subtitle and the price. "Read more" anchor links to `#product-details` if truncated. If description is absent or too short, section hides gracefully.
- **PRODUCT DETAILS accordion open by default (Section 4)** — `<details id="product-details" open>` — customer immediately sees material, origin, and product story on page load. Other accordions (Material and Care, Delivery & Returns, Gift Packaging) remain closed.
- **Wishlist heart style fix (Section 5)** — White circle background removed entirely. Heart now floats on the image with `filter: drop-shadow` for visibility across light/dark silk tones. Filled charcoal (`currentColor`, which is `--dark`) when wishlisted — never red. Scale animation preserved. Z-index fixed: `DropAHint` now renders via `createPortal(…, document.body)` escaping the `position: sticky + overflow-y: auto` ancestor that caused the Safari stacking-context bug where fixed overlays didn't cover the full viewport.
- **Free shipping reminder below price (Section 6)** — Below the price, a dynamic italic line shows: "✨ Free shipping to Ireland included" (price ≥ €150) or "Add €X for free shipping to Ireland" (price < €150, rounded up). Copy is always Ireland-specific — no international shipping logic needed yet.
- **Contact button: speech bubble + response time (Section 7)** — Floating trigger button now renders `<MessageCircle size={20} />` from lucide-react instead of `?`. Cormorant Garamond serif font removed from the trigger (inappropriate for a UI icon). "Response time: usually within 24 hours" line added below the channel list inside the panel.

**Files modified:**

- `frontend/components/ProductGallery.tsx` — full rewrite
- `frontend/components/ProductGallery.module.css` — full rewrite
- `frontend/components/ProductOptions.tsx` — lazy useState for auto-select
- `frontend/app/(shop)/product/[id]/page.tsx` — story snippet, shipping note, video prop, open accordion
- `frontend/app/(shop)/product/[id]/page.module.css` — `.storySentence`, `.readMore`, `.shippingNote`, `.price` margin adjusted
- `frontend/components/DropAHint.tsx` — `createPortal(…, document.body)` for z-index fix
- `frontend/components/ContactWidget.tsx` — `MessageCircle` icon, response time line
- `frontend/components/ContactWidget.module.css` — `.responseTime` style, font-family removed from trigger

**New dependencies:** none — mobile swipe uses native touch events, no library added.

**Schema changes:** none — `product.productVideo` already existed in the Mongoose schema (`productVideoSchema` with `url`, `thumbnailUrl`, `cloudinaryPublicId`).

**Content workflow note (for Гриша/Sabreena):**
- The `description` field is what powers the story sentence. It's already in the admin product editor.
- Recommended: Sabreena hand-writes 2–4 sentences for hero products (Aoife robe, Bare champagne nightshirt). DeepSeek generates for the rest using the brand-voice system prompt.

**Out of scope (deferred):**
- Lightbox full-screen image viewer (existing lightbox preserved on desktop image click)
- Image zoom on hover
- 360° spin views
- Reviews section
- Cart-aware free shipping message (cart total vs threshold)
- International shipping threshold logic
- Phase 1 Social Media MVP

**Verification status:**
- Desktop thumbnail strip: confirmed via code review — flex layout, 88px thumbStrip, mainArea flex: 1
- Mobile swipe + dots: confirmed — touchStart/End handlers, dots hidden on desktop, thumbStrip hidden on mobile
- Video thumbnail: Cloudinary `so_0,f_jpg` poster derivation, play icon overlay
- One Size auto-select: lazy useState init — `sizes.length === 1 ? sizes[0] : ''`
- Story sentence: `getStorySnippet()` tested for empty/short/long descriptions
- PRODUCT DETAILS open: `<details open>` attribute
- Heart: no circle background, charcoal fill, drop-shadow
- DropAHint portal: `createPortal(…, document.body)`
- Free shipping: `Math.ceil(150 - price)` for the "Add €X" variant
- Speech bubble: `<MessageCircle size={20} strokeWidth={1.5} />`
- Response time: added below channels list in ContactWidget panel

---

## 2026-05-14 (evening, late) — Three small UX fixes: banner copy, Dublin audit, logo centering

**What changed:**

- **Banner "Ireland" copy** — `AnnouncementBar.tsx` default message changed from "Handmade in Donegal with love" to "Handmade in Ireland with love". Brand logic: "Ireland" on the main banner is the internationally recognizable, welcoming surface; "Donegal" is used everywhere else (product pages, emails, story copy, AI prompts). Intentional layering, not a contradiction. Seed script `backend/scripts/seedSiteContent.js` `banner_message_3` updated to match.
- **Dublin audit** — Comprehensive grep across all file types for remaining customer-facing "Dublin" references. All legitimate: IANA timezone identifier (`'Europe/Dublin'`), geolocation city field (visitor data), contact form address placeholder (deliberate Irish address), customer shipping address fields. No further changes needed.
- **Logo centering** — `Navbar.module.css`: added `align-items: center` to `.logoLink` so both lines share a vertical axis. Added `padding-right: 4px` to `.logoText` and `padding-right: 3px` to `.logoSub` to compensate for the visual left-shift caused by CSS `letter-spacing` adding trailing space after the last glyph. Mobile override updated: `padding-right: 3px` on `.logoText` at `max-width: 767px` (matches the overridden `letter-spacing: 3px`).

**Files modified:**

- `frontend/components/AnnouncementBar.tsx` — banner message 3 updated
- `backend/scripts/seedSiteContent.js` — `banner_message_3` value updated
- `frontend/components/Navbar.module.css` — `align-items: center` on `.logoLink`; `padding-right` on `.logoText` (desktop + mobile) and `.logoSub`
- `SILKILINEN.md` — brand copy layering note added; logo CSS bug entry added to Known bugs

---

## 2026-05-14 (evening) — Fix: empty draft creation schema hardening

**What changed:**

- **Root cause:** `createEmptyDraft` backend code was correct but Railway was running pre-change code (changes not yet committed/pushed). This entry documents the schema hardening shipped alongside the deployment.
- **Product schema:** Removed `required: true` from `name`, `price`, `category`. Added safe defaults (`name: ''`, `price: 0`, `category: CATEGORY_SLUGS[0]`). Application-level validation via `validateForSave()` and `validateForPublish()` already handles required-on-save and required-on-publish. Schema `required: true` was redundant and blocked empty draft creation.
- **POST /api/admin/products (createEmptyDraft path):** Simplified — no longer needs `validateBeforeSave: false` since the schema now has defaults for all previously-required fields. `new Product({ status: 'draft', origin: 'Made in Donegal', ... }).save()` works directly.

**Files modified:**

- `backend/models/Product.js` — `name`, `price`, `category` changed from `required: true` to `required: false` with defaults
- `backend/routes/adminProducts.js` — `createEmptyDraft` path simplified (removed `validateBeforeSave: false`)

**Deployment note:**

The production fix requires a git commit and push to trigger Railway redeploy. The `createEmptyDraft` handler on the POST route was already present in the local codebase since the afternoon brief.

---

## 2026-05-14 (afternoon) — UX bug bundle: pre-window, conversion math, recently viewed, Donegal copy

**What changed:**

- **"New product" pre-window removed** — clicking "Add Product" now creates an empty draft immediately via `POST /api/admin/products` (with `createEmptyDraft: true` flag) and redirects straight to the full edit page. The intermediate form page is replaced with a spinner + auto-redirect. No more entering name/price twice. Backend accepts empty name and price=0 for this path, bypassing `validateForSave`.
- **Conversion math fixed** — `calculateConversion(buyers, visitors)` helper added. Returns `null` when visitors=0 (shows —), returns `0` explicitly when buyers=0 (shows 0.0%), caps at 100% with a warning log if buyers > visitors. Optional `showConversion` flag added: when total paid orders in the 30-day window is 0, the conversion column is hidden entirely from TOP SOURCES. This prevents "0.0% across every source" noise during the pre-revenue period.
- **Recently viewed filters deleted/archived products** — Component now fetches each product ID from the public API before rendering. Products returning 404 or with `status !== 'active'` are silently dropped. After validation, the cleaned list of valid IDs is written back to localStorage so future loads don't re-fetch deleted products. Section hides entirely when all are gone.
- **"Dublin" → "Donegal" across all customer-facing surfaces** — AnnouncementBar, Footer (badge + body + bottom line), StorySection (title + default text), About page (hero heading + body + values card), all email templates (order confirmation, magic link, welcome, newsletter — 8 replacements), Product model origin default, EMPTY_FORM fallback in admin product edit page.
- **DB migration** — 0 products had `origin: "Made in Dublin"` (schema default had already been correct in DB); 6 products had null/empty origin and were updated to `"Made in Donegal"`. All 14 products now have Donegal origin.

**Files modified:**

- `frontend/app/admin/products/new/page.tsx` — replaced with auto-creating redirect
- `frontend/app/admin/products/new/page.module.css` — added `.creating` / `.creatingText` styles
- `backend/routes/adminProducts.js` — `createEmptyDraft` flag path added to POST route
- `backend/routes/adminDashboard.js` — `calculateConversion()` helper; `showConversion` flag; total orders count added to Zone 3
- `frontend/app/admin/_components/dashboard/Zone3Working.tsx` — `showConversion` type + conditional conv. column
- `frontend/components/RecentlyViewed.tsx` — API validation on load, localStorage cleanup
- `frontend/components/AnnouncementBar.tsx` — "Dublin" → "Donegal"
- `frontend/components/Footer.tsx` — "Dublin" → "Donegal" (3 occurrences)
- `frontend/components/StorySection.tsx` — "Dublin" → "Donegal" (2 occurrences)
- `frontend/app/(shop)/about/page.tsx` — "Dublin" → "Donegal" (4 occurrences)
- `backend/services/email.js` — "Dublin" → "Donegal" (8 occurrences)
- `backend/models/Product.js` — origin default `'Made in Dublin'` → `'Made in Donegal'`
- `frontend/app/admin/products/[id]/page.tsx` — EMPTY_FORM origin default updated

**Database changes:**

- 0 products updated from `"Made in Dublin"` (none had that value)
- 6 products updated from null/empty origin → `"Made in Donegal"`
- Total: all 14 products now have `origin: "Made in Donegal"`

**Optional enhancement shipped:**

- `showConversion: false` when total orders = 0 → conversion column hidden entirely until first revenue event

**Out of scope (deferred):**

- Phase 1 Social Media MVP
- Lingerie/intimates photography workflow
- Larger dashboard redesign
- Collections / New Arrivals feature

---

## 2026-05-14 — Product form state bug fix + dashboard traffic percentages

**What changed:**

- **Admin product form: stale closure bug fixed** — `markDirty`'s 30-second auto-save timer was always calling the first-render `doSave` (which closed over `EMPTY_FORM`), sending empty values to the backend. Fixed with a `doSaveRef` pattern: a ref is kept in sync with `doSave` via `useEffect([doSave])`, and `markDirty` calls `() => doSaveRef.current?.()` instead of the stale reference. The manual Save button was not affected.
- **Dashboard traffic sources: % of traffic column added** — Each traffic source row now shows its share of total 30-day sessions alongside the conversion rate. Backend computes the denominator as total unique sessions across all sources via a separate aggregation stage. The header row labels the two right columns ("% traffic" / "conv.").
- **Dashboard geo sections: % of traffic added** — Top countries and top cities rows now show percentage of total sessions instead of raw visitor count, consistent with the traffic sources section.

**Files modified:**

- `frontend/app/admin/products/[id]/page.tsx` — `doSaveRef` added; `useEffect` syncs ref to `doSave`; `markDirty` timer updated to call ref
- `backend/routes/adminDashboard.js` — Total unique session count aggregation added; `percentOfTraffic` field added to `topTrafficSources30d`, `topCountries30d`, `topCities30d`
- `frontend/app/admin/_components/dashboard/Zone3Working.tsx` — `percentOfTraffic` field added to `TrafficSource`, `GeoCountry`, `GeoCity` types; traffic sources table gets two-column header and right-aligned stat columns; countries/cities show `%` when available

**Deviations:**

- None — implementation matches the brief exactly.

---

## 2026-05-13 — DeepSeek SEO migration

**What changed:**

- SEO generation migrated from Gemini (`gemini-2.0-flash`, now deprecated/404) to DeepSeek (`deepseek-chat`)
- New abstraction layer: `backend/services/aiText.js` wraps text-AI calls via the OpenAI SDK pointed at DeepSeek's OpenAI-compatible endpoint. Future provider swaps require only env var changes.
- Strong system prompt anchors SEO output to SILKILINEN brand voice (Donegal origin, quiet luxury tone, British English, explicit never-use word list)
- All five SEO fields returned: `metaTitle`, `metaDescription`, `slug`, `keywords`, `altTextTemplate`
- AI failures return clean 503 with human-readable message — no raw JSON ever shown to admin
- Server-side logging of every AI text call (product name, model, duration)
- Server startup logs a warning if `DEEPSEEK_API_KEY` is missing

**Files created:**
- `backend/services/aiText.js`

**Files modified:**
- `backend/routes/adminProducts.js` — import swapped to `aiText`; `generate-seo` endpoint returns structured 503 on AI failure
- `backend/server.js` — DEEPSEEK_API_KEY startup warning added
- `backend/package.json` + `package-lock.json` — `openai` SDK added
- `frontend/app/admin/products/[id]/page.tsx` — clean error messages by HTTP status; error toast condition fixed; button cost label updated to €0.0005

**Files deleted:**
- `backend/services/seoGenerator.js` — old Gemini SEO implementation removed

**Environment variables:**
- `DEEPSEEK_API_KEY` — already set in Railway
- `DEEPSEEK_MODEL_SEO` — optional, defaults to `deepseek-chat`
- `DEEPSEEK_BASE_URL` — optional, defaults to `https://api.deepseek.com/v1`

**Out of scope:**
- Image generation remains on Gemini (working correctly, unrelated)
- Other AI text uses audited and none found (SEO was the only text call to Gemini)
- Multi-provider failover not implemented

**Deviations:**
- `altTextTemplate` and `slug` added to the DeepSeek response even though the brief's sketch only showed three fields — both are used by the existing frontend and bulk-generate endpoint so they were kept.
- Cost per call is ~€0.0005 (DeepSeek pricing), updated from the old €0.001 Gemini estimate.

---

## 2026-05-13 — Photo slot UX + admin popup exclusion + visit tracking improvements

**What changed:**

- **Photo slot picker**: Clicking a named image slot (HERO, FRONT, BACK, SIDE, DETAIL, LIFESTYLE) now opens a picker modal showing all unassigned photos. Admin can choose an existing upload with "Use here" or click "Upload new photo" to open a file picker scoped to that slot. Filled slots now show two actions: "↓ Gallery" (moves photo back to additional images without deleting) and "Delete" (removes permanently).
- **AI photo auto-routing**: When admin approves an individual generated photo, it auto-places into its matching named slot (e.g., approving a `front` shot fills the Front slot). If that slot is already occupied, admin gets a confirmation: replace it or send to Additional images.
- **THUMBNAIL slot removed**: The Thumbnail named slot card is gone from the product editor. No AI shot type corresponds to it; Cloudinary handles thumbnail sizing via transformation URLs. Any images previously stored with `slot: thumbnail` appear in Additional images. Backend enum unchanged — no data migration required.
- **Admin popup exclusion**: Newsletter signup popup and cookie consent banner no longer render on `/admin/*` routes. Both check `usePathname()` and return null for admin pages. The announcement bar was already in the shop-only layout.
- **Visit tracking admin exclusion**: Already implemented prior (line 52 of `track.ts`). Confirmed — no change needed.
- **Geolocation on visits**: Each new visit now resolves country, countryCode, city, and region via ip-api.com (free, no key required). Results cached in-memory per IP for 24 hours. 3-second timeout; failure is silent and never blocks tracking.
- **Dashboard geo sections**: "Top countries (30 days)" and "Top cities (30 days)" added to the WHAT'S WORKING zone. Hidden until geo data exists.
- **Conversion rate bug fixed**: Old aggregation counted every visit document with `convertedToOrder` — a session with 4 page-views and one order counted as 4 buyers. Fixed with two-stage group: deduplicate by `(source, sessionId)`, then count per source. Added `Math.min(100, ...)` safety cap and null guard.

**Files modified:**

- `backend/models/Visit.js` — added `countryCode`, `city`, `region` fields
- `backend/routes/track.js` — added `getGeo()` with 24hr in-memory cache + ip-api.com
- `backend/routes/adminDashboard.js` — fixed conversion aggregation; added topCountries30d and topCities30d
- `backend/routes/adminProducts.js` — added `PATCH /:id/images/:imageId/slot`; extended `POST /:id/images/url` to accept optional `slot`
- `frontend/app/admin/products/[id]/page.tsx` — slot picker modal + handlers; AI auto-routing with replace prompt; "↓ Gallery" button; thumbnail removed from IMAGE_SLOTS
- `frontend/app/admin/products/[id]/page.module.css` — picker modal styles; slot action styles
- `frontend/app/admin/_components/dashboard/Zone3Working.tsx` — geo types + rendering; null-safe conversion %
- `frontend/components/AiPhotoshoot.tsx` — `onPhotoApproved` now passes `position` as `slot`
- `frontend/components/NewsletterPopup.tsx` — usePathname guard for /admin/*
- `frontend/components/CookieConsent.tsx` — usePathname guard for /admin/*

**Schema changes:**

- `Visit`: added `countryCode`, `city`, `region` (existing documents unaffected)
- `Product.images[]`: no schema change — `slot` field already existed; `thumbnail` removed from frontend IMAGE_SLOTS only

**Deviations:**

- `finalize()` in AiPhotoshoot (bulk-approve) does not pass slot — it returns one combined URL with no per-photo slot context. Individual `approvePhoto()` does pass position correctly.
- THUMBNAIL left in backend `SLOT_KEYS` enum intentionally — avoids validation failures on existing documents that have `slot: thumbnail`.

---

## 2026-05-06 — Security & Stability Hardening (Audit Remediation)

### Critical fixes

- **C1 — Server-side checkout price validation:** Backend now fetches product prices from MongoDB instead of trusting browser-sent values. Items are matched by `productId` (if provided) or product name. Prevents customers from paying arbitrary prices via DevTools manipulation. `CartItem` type extended with optional `productId`; `ProductGrid`, `ProductOptions`, and account wishlist page all populate it.

- **C2 — Customer JWT secret hardening:** `middleware/customerAuth.js` now calls `process.exit(1)` if `JWT_CUSTOMER_SECRET` is not set, matching the existing admin JWT guard. The hardcoded fallback string has been removed from both `customerAuth.js` and `routes/customers.js`.

- **C3 — Selective Mongoose validation on product saves:** `validateBeforeSave: false` is now only applied when saving a draft product. Non-draft saves run full Mongoose schema validation. Validation errors are surfaced to the admin UI with field-level detail instead of a generic 500.

- **C4 — New-product form rebuilt:** `app/admin/products/new/page.tsx` now POSTs to `POST /api/admin/products` (the admin route) using the variant-based schema. Category list is fetched from the live `/api/categories` API endpoint so it always matches the backend canonical list. Legacy flat fields (`colours`, `sizes`, `stockLevel`) removed. New products are always created as drafts and redirect to the edit page for variant/image setup.

- **C5 — Rate limiting on customer auth and newsletter:** `middleware/rateLimits.js` created with three tiers. Applied: magic-link and Google OAuth (5/10min), newsletter subscribe (10/hour), drop-a-hint (30/hour). Rate limits are skipped in development.

### High-priority improvements

- **W1 — Category enum on Product schema:** `models/Product.js` now validates `category` against the canonical slug list from `config/categories.js`. Invalid categories are rejected at the DB layer.

- **W3 — Newsletter unsubscribe:** Fixed the bug where `unsubscribeToken: null` was passed to the welcome email, causing all unsubscribe links to be invalid. The token from the upserted subscriber record is now passed. Backend redirects updated to `/unsubscribe?status=success|invalid|error`. Frontend `/unsubscribe` page created.

- **W4 — Persistent AI cost counter:** Replaced in-memory `dailyCounter` object in `routes/aiPhotos.js` with a MongoDB-backed counter using the new `models/SystemState.js` model. Counter now survives server restarts and Railway deploys.

### Infrastructure improvements (beyond audit)

- **NEW-1 — Stripe webhook signature:** Verified already in place — `stripe.webhooks.constructEvent` is called before any order processing.

- **NEW-2 — Database indexes:** Added indexes to `Order` (`status+createdAt`, `customerId+createdAt`, `customerEmail`), `Customer` (`email` unique, `googleId` sparse), and `Product` (`status+category`, `status+createdAt`, `slug` unique sparse).

- **NEW-3 — Structured logger:** `utils/logger.js` created with `info`, `warn`, `error`, `debug` methods. Outputs structured JSON in production. Available for adoption when replacing existing `console.log` calls.

### Resolved audit findings

| ID | Finding | Status |
|----|---------|--------|
| C1 | Checkout price injection | ✅ Fixed |
| C2 | Customer JWT fallback secret | ✅ Fixed |
| C3 | validateBeforeSave: false globally | ✅ Fixed |
| C4 | New-product form wrong endpoint | ✅ Fixed |
| C5 | No rate limiting on auth/newsletter | ✅ Fixed |
| W1 | Category lists out of sync | ✅ Fixed (enum validation added) |
| W3 | Newsletter unsubscribe token null | ✅ Fixed |
| W4 | AI counter resets on restart | ✅ Fixed |
| NEW-1 | Webhook signature verification | ✅ Already present |
| NEW-2 | Missing DB indexes | ✅ Added |
| NEW-3 | No structured logging | ✅ Utility added |
