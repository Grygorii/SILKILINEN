# SILKILINEN Changelog

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
