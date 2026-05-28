# SILKILINEN — Conventions

## Repo layout
```
frontend/                Next.js App Router
  app/
    (shop)/              Customer-facing routes (layout has CartContext, CookieConsentBanner, etc.)
    admin/               Admin panel (AdminLayout wraps every page)
    journal/             Public journal articles (ISR 60s)
    collections/[slug]/  Public collection pages
  components/            Shared React components
    products/            Product-specific components (ProductImage, ProductGallery, etc.)
  context/               React Context providers
  lib/                   Pure utility modules (imageUtils.ts etc.)

backend/
  routes/                Express routes — one file per resource
  models/                Mongoose schemas
  services/              Shared logic (email, shipping, discounts, tax, marketingAnalysis, segments, cartRecovery, aiText)
  middleware/            auth.js (JWT verify), rate limiters
  scripts/               One-off scripts: seed*, backfill*, auditBrokenImages.js
  docs/                  Operational docs (instagram-setup.md etc.)
```

## Naming
- **Files:** `kebab-case.ts` for utilities and routes, `PascalCase.tsx` for React components, `camelCase.js` for backend modules
- **CSS Modules:** `Component.module.css` co-located with component
- **Mongoose models:** `PascalCase.js` (e.g. `Product.js`, `Order.js`, `JournalArticle.js`)
- **Mongo collections:** Mongoose-default lowercased plural (products, orders, journalarticles)

## Auth pattern
- **Customer routes** that need a logged-in user: read `customerId` from JWT cookie set by magic-link or Google OAuth handlers
- **Admin routes:** prefix with `/api/admin/`, wrap with `requireAuth` middleware. JWT must have `algorithms: ['HS256']` set explicitly on verify (see security audit M1)
- **Public routes:** no auth, sometimes rate-limited

## Error handling
- **Public-facing errors:** structured, human-readable. No raw Mongoose CastError or Node error text leaking to clients.
- **Infrastructure failures:** return 503 with structured body
- **Validation errors:** return 400 with `{ error: 'human message', missingFields: [...] }` for the admin product validator pattern
- **Generic 500s:** `console.error('[route] error:', err); res.status(500).json({ error: 'Internal server error' })` — never `err.message` to the client
- **Cloudinary SDK errors** (carry `err.http_code`): return 502 with the actual error message so admin UI toast shows the real failure

## Validation (admin product save)
- **Save-level** (status stays draft): name + price required
- **Publish-level** (status → active): category, description ≥ 50 chars, ≥ 1 image, ≥ 1 variant
- Backend returns structured `missingFields` array; frontend shows blocking modal with field names and scrolls to first invalid field

## Admin pages
- Every admin page wraps in `<AdminLayout active="dashboard">` — the `active` prop is **required**. Missing it is a recurring bug.
- Nine sections in nav: Dashboard, Products, Orders, Customers, Marketing, Content (Journal, Social), Finance, Settings

## Image handling
- All product images go through Cloudinary `upload_stream`. Never construct a Cloudinary URL by hand — store `result.secure_url`.
- All image render sites import `isValidImageUrl` from `frontend/lib/imageUtils.ts` and filter before rendering. This blocks Gemini chat URLs at the render layer too.
- `<ProductImage>` is the standard component — shimmer skeleton while loading, branded cream "Image coming soon" placeholder on failure or missing URL.
- Cloudinary URL transforms: `w_{width},c_fill,f_auto,q_auto` — use `cloudinaryUrl(url, width)` from `imageUtils.ts`.

## Cart & checkout (v2 commerce engine)
- **Cart:** persistent, keyed by `sessionId`, 7-day MongoDB TTL
- **Checkout:** Stripe Payment Intents via embedded Elements. PI created at `POST /api/v2/checkout/create-intent`, updated (country/discount) at `POST /api/v2/checkout/update-intent`
- **Webhook:** `POST /api/webhook` — creates Order on `payment_intent.succeeded`, snapshots COGS, writes `Visit.convertedToOrder`, fires Meta CAPI
- **Order totals invariant:** `total = subtotal − discountAmount + shippingCost`. Never re-add shipping in display code. Read `order.total` as canonical.

## Cookie consent
- All non-essential scripts (analytics + marketing pixels) gate on `useCookieConsent()` from `CookieConsentContext`
- Per-category prefs (`functional`, `analytics`, `marketing`) stored as JSON in `silkilinen:cookiePrefs`
- Banner offers Accept All + Cookie Settings (modal has Reject All + Save Preferences) — Irish DPC compliant
- Footer has `<CookiePreferencesLink>` to reopen settings modal

## State documents
- **`SILKILINEN.md`** at repo root is the living state log. Update it after every shipped change.
- This `conventions.md` file is the rules-of-the-road; update only when conventions change, not for normal feature work.
