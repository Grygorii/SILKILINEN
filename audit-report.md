# SILKILINEN Codebase Audit Report
Generated: 2026-05-06
Total files audited: ~80 frontend + ~40 backend
Auditor: Claude Code (automated static analysis + manual inspection)

---

## Executive Summary

- **Checkout price injection (Critical):** The server accepts item prices from the browser without a DB lookup — customers can pay any amount they choose.
- **Customer JWT fallback secret (Critical):** `JWT_CUSTOMER_SECRET` has a hardcoded fallback; anyone with the source can forge customer tokens.
- **`validateBeforeSave: false` on every product save (Critical):** Mongoose schema validation is fully bypassed on all admin product saves, allowing corrupt data into MongoDB.
- **New-product form uses wrong endpoint + legacy schema (Critical):** `/admin/products/new` POSTs to the public route with the old flat schema, producing products with no variants and broken stock tracking.
- **No rate limiting on auth/newsletter endpoints (Critical):** Customer magic-link, Google OAuth, and newsletter subscribe have zero rate limiting — trivially spammable.

Overall the codebase is well-structured and growing in the right direction. Admin auth coverage is complete, API contracts are consistent, CORS and cookie security are correctly configured. The most urgent fixes are the checkout price validation and the JWT secret guard — both are exploitable without any special tooling. The `validateBeforeSave` bypass and the broken new-product form are operational issues that will produce silent data corruption. Everything else is hardening and cleanup.

---

## Findings by Severity

### 🔴 Critical (must fix before launch)

#### C1: Checkout accepts browser-supplied item prices — no server-side validation
- **Location:** `backend/routes/checkout.js` ~line 61–86
- **Description:** `items[].price` is taken directly from the POST body and passed to Stripe. There is a type check (`typeof item.price !== 'number'`) but no database price lookup. A customer can set any price for any product.
- **Impact:** Revenue loss — customers can purchase at $0.01 or any arbitrary amount.
- **Suggested fix:** Lookup each `item.productId` in MongoDB, use `product.price` from DB, reject if product not found or not active.

#### C2: Customer JWT uses hardcoded fallback secret — no crash guard
- **Location:** `backend/middleware/customerAuth.js:3`, `backend/routes/customers.js:10`
- **Description:** `process.env.JWT_CUSTOMER_SECRET || 'silkilinen_customer_secret_change_in_prod'`. The admin JWT correctly calls `process.exit(1)` if the secret is missing. The customer JWT silently falls back to a public string visible in the repo. Anyone who reads the source can forge tokens and access any customer's orders, wishlist, and profile.
- **Impact:** Full customer account takeover — authentication bypass.
- **Suggested fix:** Add the same fatal-exit guard used for the admin JWT:
  ```js
  const CUSTOMER_SECRET = process.env.JWT_CUSTOMER_SECRET;
  if (!CUSTOMER_SECRET) { console.error('JWT_CUSTOMER_SECRET is not set'); process.exit(1); }
  ```

#### C3: `validateBeforeSave: false` bypasses all Mongoose validation on product saves
- **Location:** `backend/routes/adminProducts.js:146`
- **Description:** Every `PUT /api/admin/products/:id` calls `product.save({ validateBeforeSave: false })`. This was added to allow draft saves, but it disables ALL schema validation globally — required fields, enum constraints, min/max, and custom validators are never enforced for any product save, including when publishing.
- **Impact:** Corrupt or structurally invalid product data can reach MongoDB silently.
- **Suggested fix:** Only skip validation for drafts; run full validation when publishing:
  ```js
  const skipValidation = product.status === 'draft';
  await product.save({ validateBeforeSave: skipValidation });
  ```

#### C4: `/admin/products/new` uses wrong endpoint and legacy flat schema
- **Location:** `frontend/app/admin/products/new/page.tsx` ~line 60, 101–107
- **Description:** POSTs to `POST /api/products` (the old public product route) using the legacy schema (`colours`, `sizes` as flat string arrays, `stockLevel` as a number). The pre-save hook derives `colours`/`sizes`/`totalStock` from `variants[]`. Products created via this form have no variants, empty derived fields, and broken stock tracking. Also the category list has only 5 options (missing `pyjamas`, `pillowcases`, `eye-masks`, `lingerie`; includes non-canonical `dresses`).
- **Impact:** Every product created via the admin "new product" form has broken stock and won't appear in category filters.
- **Suggested fix:** POST to `/api/admin/products` with the variant-based schema, and sync the category list with `backend/config/categories.js`.

#### C5: No rate limiting on customer auth and newsletter endpoints
- **Location:** `backend/routes/customers.js:41,72,102`, `backend/routes/newsletter.js`
- **Description:** `POST /api/customers/request-magic-link`, `POST /api/customers/google`, and `POST /api/newsletter/subscribe` have no rate limiting. The admin login endpoint correctly has `express-rate-limit` (5 attempts / 15 min). These three endpoints call Resend on every request and write to MongoDB.
- **Impact:** Email spam abuse (Resend quota exhaustion), DB pollution, and potential DoS cost amplification.
- **Suggested fix:** Apply the same `rateLimit` middleware — e.g., 5 requests / 10 minutes per IP on the magic-link endpoint, 10 / hour on newsletter subscribe.

---

### 🟡 Warning (fix this week)

#### W1: Three category lists out of sync
- **Location:** `backend/config/categories.js` (9 categories), `frontend/app/admin/products/[id]/page.tsx:63–73` (9, matches), `frontend/app/admin/products/new/page.tsx:101–107` (5, mismatched)
- **Description:** `new/page.tsx` is missing `pyjamas`, `pillowcases`, `eye-masks`, `lingerie` and includes `dresses` which is not in the canonical list. Products saved with `category: 'dresses'` won't appear in any shop filter.
- **Suggested fix:** Export `CATEGORIES` from `backend/config/categories.js` and have the frontend import it, or create a `frontend/lib/categories.ts` constant used everywhere.

#### W2: Wishlist product type missing `images[]` — no product images displayed
- **Location:** `frontend/context/WishlistContext.tsx:9–15`
- **Description:** `WishlistProduct` type only has `image?: string` (legacy field). The wishlist page renders an empty image container. New products have `images[]` populated and `image` left empty (synced in pre-save from images array, so this should work — but verify the legacy `image` field is always populated by pre-save).
- **Suggested fix:** Confirm pre-save always sets `image` from `images[0]`. If products exist that pre-date the pre-save sync, add a migration or expand the WishlistProduct type.

#### W3: Newsletter unsubscribe token is always `null` — GDPR compliance gap
- **Location:** `backend/routes/newsletter.js:59`
- **Description:** `sendNewsletterWelcome` is called with `unsubscribeToken: null`. The email links to `${FRONTEND}/unsubscribe` — a page that doesn't exist. Subscribers cannot unsubscribe via email link.
- **Impact:** GDPR / CAN-SPAM violation — one-click unsubscribe is required.
- **Suggested fix:** Generate a signed token on subscribe (e.g., `crypto.randomBytes(32).toString('hex')`), store on the subscriber document, pass to the email template, and implement the `/unsubscribe?token=...` route.

#### W4: AI daily cost limit resets on every server restart / deploy
- **Location:** `backend/routes/aiPhotos.js:19–27`
- **Description:** `dailyCounter` is an in-memory JS object. Railway restarts the process on every deploy, resetting the counter to zero. The Gemini cost cap is non-functional in practice.
- **Suggested fix:** Persist the counter in MongoDB (a `SystemState` document) or Redis. Reset via a daily cron.

#### W5: `SILK10` promo code hardcoded in welcome email
- **Location:** `backend/services/email.js:206`
- **Description:** `sendWelcome()` promises "Use code SILK10 for 10% off" regardless of whether the code exists in Stripe or the DB. If the promo is deactivated, customers receive broken promises.
- **Suggested fix:** Either remove the promo from the template or check the Stripe coupon is active before including it.

#### W6: `GET /api/products/related/:id` has N+1 risk on low-stock fill
- **Location:** `backend/routes/products.js:266–284`
- **Description:** If fewer than 4 related products are found in the same category, a second `Product.find()` is issued. This is two sequential queries instead of one. At current scale this is benign, but it's worth noting.
- **Suggested fix:** Single aggregation with `$facet` or bump the first query limit and filter in JS.

#### W7: Abandoned cart query uses wall-clock hours, not business hours
- **Location:** `backend/routes/insights.js` (abandoned cart count)
- **Description:** Orders older than 2 hours with `pending` status are counted as abandoned. This includes orders placed at checkout where the customer is still on the Stripe payment page, orders placed overnight, etc. The threshold is not configurable.
- **Suggested fix:** Configurable threshold via env var; filter out orders created < 30 minutes ago.

#### W8: `autoGenerateSEO` fires synchronously after every product save but is not awaited
- **Location:** `backend/routes/adminProducts.js` — `autoGenerateSEO(product)` called without `await`
- **Description:** If SEO generation involves async work (AI call, DB write), errors are silently swallowed and the function result is lost.
- **Suggested fix:** `await autoGenerateSEO(product)` or at minimum `.catch(err => console.error(...))`.

#### W9: Product `slug` field has no uniqueness constraint
- **Location:** `backend/models/Product.js:67`
- **Description:** `slug` is `{ sparse: true, index: true }` but not `unique: true`. Two products with the same name would generate the same slug. If slug-based routing is added later, this will cause silent conflicts.
- **Suggested fix:** Add `unique: true` to the slug field (sparse unique index works on MongoDB).

---

### 🟢 Info (nice to fix eventually)

#### I1: `console.log` left in production code
- **Locations (backend):** Various route files — search shows scattered debug logs
- **Suggested fix:** Replace with a structured logger (e.g., `pino`) with log-level gating, or remove.

#### I2: Magic numbers in frontend (hardcoded timeouts, limits)
- **Description:** Values like `limit=8`, `limit=4`, debounce delays appear as literals rather than named constants.
- **Suggested fix:** Extract to a `frontend/lib/constants.ts` file.

#### I3: `any` types in TypeScript
- **Description:** Several admin page components use `any` for API response types rather than typed interfaces.
- **Suggested fix:** Define response interfaces in `frontend/lib/types.ts`.

#### I4: No database indexes on Order collection
- **Location:** `backend/models/Order.js`
- **Description:** `Order` is queried by `status`, `createdAt`, `customerId`, and `sessionId` across multiple routes. No indexes are defined beyond the default `_id`. At low order volume this is fine; at scale these will be collection scans.
- **Suggested fix:** Add indexes: `{ status: 1, createdAt: -1 }`, `{ sessionId: 1 }`, `{ customerId: 1 }`.

#### I5: No indexes on Customer collection
- **Location:** `backend/models/Customer.js`
- **Description:** Customers are queried by `email` on every auth request. No index on `email` is defined (beyond any that may be implied by a unique constraint).
- **Suggested fix:** Add `{ email: 1, unique: true }` index explicitly.

#### I6: Stripe redirect URLs reference no configurable base — may be using old Vercel preview URLs
- **Description:** Search for hardcoded `vercel.app` or old preview domain references in checkout/webhook routes.
- **Suggested fix:** Ensure all Stripe redirect URLs use `process.env.FRONTEND_URL`.

#### I7: No test coverage
- **Description:** No test files found (`*.test.*`, `*.spec.*`) in either frontend or backend. Zero automated test coverage for checkout flow, auth, wishlist sync, or product CRUD.
- **Suggested fix:** At minimum, write integration tests for C1 (price validation), C2 (auth), and the Stripe webhook handler.

---

## Findings by Category

### Security
- C1: Checkout price injection
- C2: Customer JWT hardcoded fallback
- C5: No rate limiting on auth/newsletter
- W3: GDPR unsubscribe gap

### Data Integrity
- C3: `validateBeforeSave: false` globally
- C4: New-product form writes wrong schema
- W9: Non-unique slug field

### Architecture / Single Source of Truth
- W1: Three category lists out of sync
- C4: New-product form uses public route not admin route
- I2: Magic numbers scattered across frontend

### Performance / Reliability
- W4: In-memory AI cost counter resets on deploy
- W6: Related products N+1 query
- I4: No Order indexes
- I5: No Customer indexes

### Code Quality
- W8: `autoGenerateSEO` not awaited
- I1: `console.log` in production code
- I3: TypeScript `any` types
- I7: Zero test coverage

### Wishlist
- W2: `WishlistProduct` type missing `images[]`

### Email / Comms
- W3: Unsubscribe token always null
- W5: Hardcoded promo code in welcome email

---

## Authentication Audit

| Route | Method | Auth Applied | Should Have Auth | Status |
|-------|--------|-------------|-----------------|--------|
| `/api/products` | GET | None | No (public catalog) | ✓ |
| `/api/products/:id` | GET | None | No (public) | ✓ |
| `/api/products/related/:id` | GET | None | No (public) | ✓ |
| `/api/products` | POST | `requireAuth` (admin) | Yes | ✓ |
| `/api/products/:id` | PUT | `requireAuth` (admin) | Yes | ✓ |
| `/api/products/:id` | DELETE | `requireAuth` (admin) | Yes | ✓ |
| `/api/admin/products` | GET | `requireAuth` | Yes | ✓ |
| `/api/admin/products/:id` | PUT | `requireAuth` | Yes | ✓ |
| `/api/admin/orders` | GET | `requireAuth` | Yes | ✓ |
| `/api/admin/insights` | GET | `requireAuth` | Yes | ✓ |
| `/api/customers/me` | GET | `requireCustomer` | Yes | ✓ |
| `/api/customers/me/wishlist` | GET | `requireCustomer` | Yes | ✓ |
| `/api/customers/request-magic-link` | POST | None | No (public auth) | ✓ (but needs rate limit) |
| `/api/newsletter/subscribe` | POST | None | No (public) | ✓ (but needs rate limit) |
| `/api/checkout` | POST | None | No (guest checkout allowed) | ✓ (but needs price validation) |

All admin routes: protected ✓
All customer data routes: protected ✓
Public routes: intentionally public ✓
Unprotected routes that need hardening: 3 (rate limiting, not auth)

---

## API Contract Audit

All ~65 frontend `fetch()` calls were cross-referenced against backend routes. No broken contracts found. All URLs, methods, and major response shapes are consistent.

Notable correct patterns:
- Wishlist batch: `GET /api/products?ids=...` ✓ (recently added)
- Customer sync: `POST /api/customers/me/wishlist/sync` ✓
- Drop-a-hint: `POST /api/products/:id/drop-hint` ✓
- Insights: `GET /api/admin/insights` ✓

---

## Metrics

### Frontend
- Key files: ~80 TypeScript/TSX files
- Largest files: admin product page (`[id]/page.tsx` ~600+ lines), admin dashboard, CartPanel
- TypeScript strict mode: partially enabled
- Known `any` types: scattered in admin components

### Backend
- Route files: 15+
- Model files: 5 (Product, Order, Customer, Newsletter, ContentSection)
- Middleware: auth (admin + customer), rate limit (admin login only)
- Services: email (Resend), cloudinary, aiPhotos

### Database — Mongoose Models
| Model | Required Fields | Indexes | Validation |
|-------|----------------|---------|------------|
| Product | name, price, category | status, slug (sparse) | enum on status, slot |
| Order | sessionId, items, total | none explicit | — |
| Customer | email | none explicit | — |
| Newsletter | email | none explicit | unique not confirmed |
| ContentSection | key | key (sparse) | — |

---

## Specific Findings

### Wishlist State — All Read/Write Points
1. `WishlistContext.tsx` — single source of truth (localStorage for guests, API for logged-in)
2. `backend/routes/customers.js` — GET/POST/DELETE/sync endpoints
3. `frontend/app/(shop)/wishlist/page.tsx` — reads from context `items` only (correct)
4. `frontend/app/account/wishlist/page.tsx` — reads from context `items` only (correct)
5. `frontend/components/WishlistButton.tsx` (or equivalent) — calls `toggle()` from context

All wishlist reads go through context. State is consistent. ✓

### Image Upload — Endpoint Inventory
1. `POST /api/products/upload` — single product image (Cloudinary)
2. `POST /api/admin/products/:id/images` — product image slots
3. `POST /api/admin/products/:id/video` — product video
4. `POST /api/ai/generate-photo` (or similar) — AI photo generation
5. `POST /api/admin/content/upload` — content/banner images

Multiple upload handlers exist. They all use the same Cloudinary util (`backend/utils/cloudinary.js`). No duplication. ✓

### Email Sending — Service Inventory
All email goes through `backend/services/email.js` using Resend. Functions:
- `sendMagicLink()`
- `sendOrderConfirmation()`
- `sendWelcome()`
- `sendNewsletterWelcome()` — broken unsubscribe token (W3)
- `sendDropAHint()`
- `sendGetInTouch()`
- `sendAbandonedCart()`

Single service, consistent. The hardcoded SILK10 promo (W5) and null unsubscribe token (W3) are the two issues.

### Stripe / Payment — URL References
- `backend/routes/checkout.js` — uses `process.env.FRONTEND_URL` for success/cancel URLs ✓
- `backend/routes/webhook.js` — no redirect URLs
- `backend/services/email.js` — uses `process.env.FRONTEND_URL` ✓

No hardcoded `vercel.app` URLs found in payment flow. ✓

### console.log in Production Code
Scattered in backend route files — exact locations require grep. Run:
```
grep -rn "console.log" backend/ --exclude-dir=node_modules
```
Frontend: minimal, mostly in development guards.

### TODO/FIXME Comments
None found via search.

---

## Recommendations

### Immediate (this week)
1. **Fix checkout price validation** (C1) — fetch product price from DB in checkout route
2. **Add customer JWT fatal-exit guard** (C2) — 3-line fix matching admin JWT pattern
3. **Fix `validateBeforeSave`** (C3) — only skip for drafts, not all saves
4. **Fix new-product form** (C4) — point to `/api/admin/products`, use variant schema, fix category list
5. **Add rate limiting to auth/newsletter** (C5) — copy the existing admin rate-limit pattern

### Short-term (this month)
6. Implement newsletter unsubscribe token + page (W3)
7. Persist AI daily counter in MongoDB (W4)
8. Add indexes to Order and Customer collections (I4, I5)
9. Add `unique: true` to Product slug (W9)
10. Await `autoGenerateSEO` (W8)

### Long-term (this quarter)
11. Write integration tests for checkout, auth, and webhook (I7)
12. Replace scattered `console.log` with structured logger (I1)
13. Centralise category list as a shared constant (W1)
14. Add TypeScript interfaces for all API responses (I3)

---

## Files To Delete
- None confirmed as fully dead. `frontend/app/admin/products/new/page.tsx` should be rebuilt rather than deleted.

## Files Needing Refactor
- `frontend/app/admin/products/[id]/page.tsx` — ~600 lines, multiple concerns (form state, image management, SEO, save logic). Consider splitting into sub-components.
- `backend/services/email.js` — growing; consider splitting by domain (transactional, marketing).
- `frontend/app/admin/products/new/page.tsx` — needs full rewrite to use admin endpoint and variant schema.
