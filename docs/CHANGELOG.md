# CHANGELOG

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
