# CHANGELOG

## 2026-05-16 (hotfix) — Three post-deployment fixes

**What changed:**
- Fixed E11000 duplicate key error on `Order.stripePaymentIntentId` via partial unique index (allows multiple null values, enforces uniqueness only when set to a string)
- Built admin abandoned carts page at `/admin/marketing/abandoned-carts` (was 404 before)
- Added Collections link to admin sidebar under Publish section (Layers icon)

**Files modified:**
- `backend/models/Order.js`
- `frontend/components/AdminLayout.tsx`

**Files created:**
- `backend/scripts/fix-order-indexes.js` — one-time cleanup script
- `frontend/app/admin/marketing/abandoned-carts/page.tsx`
- `frontend/app/admin/marketing/abandoned-carts/page.module.css`

**Database changes (run fix-order-indexes.js once via Railway shell):**
- Drop old unique indexes: `stripeSessionId_1`, `stripePaymentIntentId_1`, `orderNumber_1`
- Replace with partial unique indexes (partialFilterExpression: `$type: 'string'`)
- Delete orphan pending/failed orders with both Stripe IDs null

**Root cause:**
- MongoDB unique indexes treat `null` as a value by default. Schema fields with `unique: true, default: null` only allow ONE document with null — every subsequent checkout attempt created a second pending order and hit the duplicate key constraint. Partial indexes with `$type: 'string'` enforce uniqueness only when the field is actually set.

**Lesson for future schemas:**
- Any field that is unique BUT can be null at insert time must use `partialFilterExpression` to allow multiple null/undefined documents. Never combine `unique: true` with `default: null` on a Mongoose schema field.

**Environment policy (standing instruction from Гриша):**
- SILKILINEN is single-environment — production only
- No staging, no test databases, no test Stripe instances
- Safety net is `git revert` for code rollbacks
- Do not spin up parallel test infrastructure for future changes

---

## 2026-05-16 (urgent hotfix) — Fix module import path

**What changed:**
- Fixed broken `require('../middleware/requireAdmin')` in `adminCollections.js`
- Updated to use actual admin auth middleware: `{ requireAuth }` from `'../middleware/auth'`

**Root cause:**
- Brief specified middleware filename (`requireAdmin`) that didn't match existing codebase convention (`requireAuth` in `auth.js`). The error only surfaced at production startup on Railway — not caught locally.

**Lesson:**
- Future briefs should verify middleware names against existing codebase before specifying imports. Check `backend/middleware/` first.

---

## 2026-05-16 — Collections system, parallel Payment Intents checkout, UX polish

**Section B — Collections:**
- Collection model, admin CRUD API, public API, seeded 5 initial collections
- Admin UI: list page + create/edit page with product assignment
- Storefront `/collections/[slug]` pages, FeaturedCollections on homepage

**Section A — Parallel commerce engine (Payment Intents):**
- Cart model + API, shipping/discount/tax services
- `checkoutV2.js`: create-intent + webhook; `/checkout` page with Stripe Elements
- Order model extended with orderNumber, paymentIntentId, refunds
- Admin refund UI + `POST /api/orders/:id/refund`

**Section C/D/E — UX + policy:**
- Colour cubes replacing hex swatches; shipping page rewritten; policy dates updated
