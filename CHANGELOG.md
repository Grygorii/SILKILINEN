# SILKILINEN Changelog

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
