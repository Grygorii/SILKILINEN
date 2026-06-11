# SILKILINEN — Full Website Audit

_Senior full-stack + SEO + conversion audit. Generated from a code-level review of `backend/` (Express) and `frontend/` (Next.js 16). Every finding cites file:line. `FACT` = verifiable in code; `JUDGMENT` = professional opinion. Tags: `[SEVERITY][EFFORT][IMPACT]`._

---

## 1. Executive summary

The codebase is **fundamentally sound** — Stripe price validation is server-side and correct, admin auth uses a single-use bootstrap nonce (JWT never touches browser JS), mass-assignment is allow-listed on admin product writes, Cloudinary uploads are signed with magic-byte validation, and `tsc --noEmit` passes clean with `strict: true`. That's a better baseline than most stores at this stage.

But there are **five things that genuinely matter right now**:

1. **🔴 The journal XSS is not actually fixed** — the DOMPurify fix was silently replaced with a bypassable regex sanitizer (`frontend/lib/sanitize.ts`). This is the only CRITICAL security item.
2. **🔴 Images are the biggest unrealised lever** — the storefront uses raw `<img>` everywhere (zero `next/image`), no responsive `srcset`, and several images ship full-resolution un-transformed. For an image-heavy silk catalogue this is the #1 performance + mobile-conversion fix.
3. **🟠 You promise free shipping €50 below your real bar** — homepage says "Free EU Shipping over €150" but the backend charges EU shipping until €200. A live revenue/trust bug.
4. **🟠 Trust is thin where it converts** — reviews are largely empty (no per-product star snippets), and the PDP buries shipping/returns/secure-payment in collapsed accordions while a **fabricated "just sold" popup** invents buyer names (deceptive-pattern + EU consumer-law risk).
5. **🟠 Muted body text fails WCAG AA contrast** (`#8A8278` on `#FAF8F4` ≈ 3:1) across the whole funnel — readability and accessibility hit at the same time.

**Single highest-leverage fix:** the image pipeline (next/image + `srcset` + `cloudinaryAuto` on the un-transformed images). It's the biggest win for mobile LCP, bandwidth, and the "bright luminous silk" brand promise simultaneously.

**Tempting distraction to ignore:** more AI/dashboard features before reviews, images, and the trust/contrast basics are done.

---

## 2. Findings by dimension

### 2.1 Security

- `[CRITICAL][M][risk] JUDGMENT` — **Regex HTML sanitizer is bypassable; stored XSS in journal articles is not actually closed.** `frontend/lib/sanitize.ts:17-33` (used by `app/journal/(public)/[slug]/page.tsx:89`, `journal/preview/page.tsx:75`, `components/AnnouncementBar.tsx:39`). The report's H1 claims DOMPurify; the code was swapped to a hand-rolled regex because DOMPurify broke Turbopack SSR. Bypasses survive: handlers split by `/`/newline (`<img/onerror=…>`), unclosed/nested `<scr<script>ipt>`, framing tags not in the strip list (`<svg onload>`, `<details ontoggle>`), `data:` URIs outside href/src. Article bodies render from the DB onto the silkilinen.com origin → session theft / fake checkout. **Fix:** server-side `sanitize-html` (runs in Node SSR without jsdom) or render TipTap to a strict allowlisted AST.
- `[HIGH][S][risk] FACT` — **Email templates interpolate customer-controlled data unescaped.** `backend/services/email.js:33,38` (item name/colour/size), `:45-47,131` (`formatAddress` → shipping address), `:86,278` (`customerName`). Only `sendDropAHint` was hardened. Name/phone/address come from Stripe PaymentIntent (`checkoutV2.js:462-472`) — buyer-controlled — and render unescaped into the **admin's** order-notification inbox (HTML/phishing injection). **Fix:** wrap every user-derived value in the existing `esc()` helper.
- `[MEDIUM][S][risk] FACT` — **Customer JWT verify doesn't pin the algorithm.** `backend/middleware/customerAuth.js:13,23` calls `jwt.verify(token, SECRET)` without `{ algorithms: ['HS256'] }`; the admin path was fixed (`middleware/auth.js:7`) but the 30-day customer path was missed. **Fix:** add `{ algorithms: ['HS256'] }` to both verifies.
- `[MEDIUM][S][risk] FACT` — **Google ID token verified via network round-trip with the token in the URL.** `backend/routes/customers.js:112` — `fetch(...tokeninfo?id_token=${credential})` puts the token in a URL (proxy/log leak) and `exp` isn't validated locally. **Fix:** verify offline with `google-auth-library` `verifyIdToken` (checks signature/aud/iss/exp).
- `[MEDIUM][M][risk] JUDGMENT` — **CSRF defence is header-presence + CORS, with a `SameSite=none` customer cookie and a no-Origin allowance.** `backend/middleware/csrf.js:42-46`, `server.js:122-127` (`callback(null,true)` when no Origin). Defensible given the allowlist, but fragile. **Fix:** document that the no-Origin allowance must never be relaxed; consider a double-submit token for the customer flows; confirm `CORS_ORIGINS` is exact in prod.
- `[LOW][S][risk] FACT` — **Preview tokens fall back to the admin `JWT_SECRET`.** `backend/routes/adminProducts.js:237` (`PREVIEW_TOKEN_SECRET || JWT_SECRET`) — key reuse across trust domains. **Fix:** require a dedicated `PREVIEW_TOKEN_SECRET`.
- `[LOW][S][maintainability] FACT` — **Webhook signature-failure echoes the raw Stripe error.** `backend/routes/checkoutV2.js:359`. **Fix:** log server-side, return generic `{ error: 'Invalid signature' }`.

**Verified sound (no action):** Stripe price validation recomputes from DB and charges `intent.amount` (`checkoutV2.js:106-150,452`); webhook signature verified with raw body before `express.json()` (`server.js:135`); admin JWT pins HS256; admin token never reaches the browser (bootstrap-nonce architecture); product mass-assignment allow-listed (`pickProductFields`); Cloudinary uploads signed + magic-byte validated; no secrets committed.

### 2.2 Code quality & architecture

- `[HIGH][M][revenue] FACT` — **Free-shipping promise mismatch.** `frontend/components/ReassuranceRow.tsx:11` says "Free EU Shipping over €150" but `backend/services/shipping.js:9,30` sets the EU/Europe free bar at €200 (€150 is Ireland). Promising free shipping €50 below the real threshold. **Fix:** derive the figure from the shipping service / a SiteContent key.
- `[HIGH][M][revenue] FACT` — **Public Shipping page hand-codes a rate table that duplicates (and mislabels) the authoritative tiers.** `frontend/app/(shop)/shipping/page.tsx:46-78` vs `backend/services/shipping.js:4-50`; "Europe" (incl. Norway/Switzerland/Iceland) is labelled "European Union." Any backend rate change makes the page lie. **Fix:** render from the shipping service.
- `[HIGH][M][risk] FACT` — **Three disagreeing "countries we ship to" lists.** Checkout `ALLOWED_COUNTRIES` ~38 codes (`checkout/page.tsx:34-41`) vs Addresses `<select>` 9 countries (`account/addresses/page.tsx:83-93`) vs `shipping.js` tiers. A customer can check out to Finland but can't then select it to edit the saved address. **Fix:** derive all from the backend tiers.
- `[HIGH][M][risk] FACT` — **No validation library; several mutating routes pass `req.body` straight to Mongoose.** `backend/routes/products.js:267,368` (`Product.create`/`findByIdAndUpdate` — no allowlist, unlike the admin route), `customers.js:167`, `orders.js:209,230`, `content.js:157`. Mass-assignment + inconsistent contracts. **Fix:** add zod/joi validation + field allow-lists.
- `[HIGH][M][maintainability] FACT` — **The documented central API client `lib/api.ts` is dead code** (zero imports); CSRF is instead a global `window.fetch` monkey-patch (`components/CsrfFetchPatch.tsx`), and 102 raw `fetch()` call-sites re-implement error/JSON boilerplate. **Fix:** adopt `lib/api.ts` everywhere or delete it.
- `[MEDIUM][M][maintainability] FACT` — **Hardcoded policy content that already self-contradicts.** FAQ array (`faq/page.tsx:10-55`) says processing "1-3 days" / "exchanges welcome" while Shipping says "1-2 days" (`shipping/page.tsx:21`) and Returns says "no direct exchanges" (`returns/page.tsx:87`). Return window, fault window, refund timeframes, size charts all hardcoded in JSX. The `SiteContent` model/route already exist for this. **Fix:** move policy copy to SiteContent.
- `[MEDIUM][S][risk] FACT` — **Social links drift across consumers.** Footer reads `/api/social/platforms`, but `ContactWidget.tsx:21-23` and the SEO `sameAs` JSON-LD (`app/layout.tsx:148-150`) hardcode them — deactivating a social in admin leaves a stale Knowledge-Graph signal. **Fix:** consume the API in both. _(Side menu was fixed this session.)_
- `[MEDIUM][S][maintainability] FACT` — **`hello@silkilinen.com` hardcoded in ~14 files.** Changing the support address is a 14-file edit. **Fix:** centralize in SiteContent/config.
- `[MEDIUM][S][risk] FACT` — **DB connection failure doesn't stop the server.** `backend/server.js:183-185,232` — `mongoose.connect(...).catch(log)` while `app.listen` runs unconditionally → serves 500s with no DB. **Fix:** `process.exit(1)` on connect failure (mirror the `JWT_SECRET` guard).
- `[MEDIUM][S][brand] FACT` — **Fetch failures render false empty states.** `account/orders/page.tsx:38` and `admin/customers/page.tsx:65` show "nothing yet"/"no customers" on a failed request; `admin/products/page.tsx:684-690` hides its error banner inside the `length>0` branch. **Fix:** explicit error+retry states.
- `[MEDIUM][S][revenue] FACT` — **Guest wishlist can be wiped on login.** `frontend/context/WishlistContext.tsx:116-117` clears localStorage even when the merge POST `.catch(()=>{})` fails. **Fix:** only clear local on a confirmed merge.
- `[MEDIUM][M][risk] FACT` — **Test coverage is thin** (3 files, ~20 cases: auth, file-signature, schema) against 40 route files; the **entire checkout/webhook money-path is untested** (`backend/tests/`). **Fix:** integration tests for checkout/cart/orders first.
- `[MEDIUM][S][maintainability] FACT` — **27 MB `backend/stripe.exe` (Stripe CLI binary) is committed to git.** Bloats the repo; not in `.gitignore`. **Fix:** `git rm --cached backend/stripe.exe` and gitignore it.
- `[LOW][M][maintainability] FACT` — **Duplication:** regex-escape ×4, pagination clamp ×8, cookie-options ×2-4, review validation ×2, discount re-validation ×2-3, category-delete guard ×2. Heavy logic lives in routes (order creation/COGS in `checkoutV2.js:353-592`; `/stats` aggregation in `orders.js:23-100`; CSV parser in `products.js:27-143`). `adminProducts.js` is 946 lines. **Fix:** extract shared `utils/` helpers + an `orderService`.
- `[LOW][S][maintainability] FACT` — **No `.env.example`**; required vars only discoverable by grep. **Fix:** commit `.env.example` for both apps.
- `[LOW][S][maintainability] FACT` — Inconsistent response shapes (bare arrays vs `{orders,total,...}`; `reviews` GET returns two shapes by query param); `count` (public) vs `productCount` (admin); PUT vs PATCH for single-field updates. **Fix:** settle one envelope/convention.

**Good (no action):** `tsc --noEmit` clean, `strict: true`, negligible `any`; boot-time `JWT_SECRET`/CORS guards; sound ESLint config.

### 2.3 Performance & Core Web Vitals

- `[CRITICAL][M][revenue] FACT` — **Zero `next/image` adoption; raw `<img>` everywhere** (`ProductCard.tsx:96`, `FeaturedCollections.tsx:39`, `InstagramGrid.tsx:62`, `BlogTeaser.tsx:41`, `CategoryTiles.tsx:44`, `ProductImage.tsx:84`, `page.tsx:64`, `collections/[slug]/page.tsx:78`, all with `eslint-disable no-img-element`). Forfeits automatic `srcset`/lazy/CLS-safe sizing — the biggest CWV lever for an image catalogue. `next.config.ts:18-24` already allows `res.cloudinary.com`. **Fix:** migrate storefront images to `next/image` (or hand-build `srcSet`).
- `[CRITICAL][S][revenue] FACT` — **No responsive `srcset`/`sizes` anywhere** — every device downloads one fixed width (`ProductImage.tsx:86`, `CategoryTiles.tsx:44` `w_600`, `BlogTeaser.tsx:41` `w_600`). Retina phones get blur; low-DPR over-downloads. **Fix:** multi-width `srcSet` + `dpr_auto` + real `sizes`.
- `[CRITICAL][S][revenue] FACT` — **Several images ship full-resolution un-transformed**, bypassing `cloudinaryAuto`: `FeaturedCollections.tsx:39`, `collections/[slug]/page.tsx:79`, `BundlePageClient.tsx:41`, `about/page.tsx:33-45` use the raw URL (no `f_auto`/`q_auto`/width — the same class that caused the 13 MB flagged savings). **Fix:** wrap every storefront URL in `cloudinaryAuto(url, maxWidth)`.
- `[HIGH][S][revenue] FACT` — **Hero LCP image has no `srcset`** — mobile downloads the 1920px desktop asset (`page.tsx:65`, `cloudinaryAuto(heroImage,1920)`, `fetchPriority="high"` but single src). **Fix:** add 768/1080/1440/1920 `srcSet`.
- `[HIGH][M][revenue] FACT` — **Main shop grid is `cache: 'no-store'`** (`shop/page.tsx:116`) — the highest-traffic browse page re-hits the backend every request, no ISR/CDN, unlike NewArrivals/CategoryTiles (revalidate 3600). **Fix:** `next: { revalidate: 60 }`.
- `[HIGH][S][revenue] FACT` — **InstagramGrid serves un-transformed IG-CDN images** (`InstagramGrid.tsx:62`). **Fix:** proxy via Cloudinary fetch `f_auto,q_auto,w_400`.
- `[MEDIUM][S][revenue] JUDGMENT` — **PDP/collection/bundle detail also `no-store`** (`product/[id]/page.tsx:19`, `collections/[slug]/page.tsx:35`, `bundles/[slug]/page.tsx:32`) — money pages with no CDN caching. **Fix:** `revalidate: 60-300`.
- `[MEDIUM][M][revenue] FACT` — **Missing Mongo indexes on storefront queries:** `isNewArrival` (`models/Product.js:60`, queried `products.js:193`), `Product.collections` (`collections.js:38`), `Bundle.categories` (`bundles.js:40`). **Fix:** add compound/array indexes.
- `[MEDIUM][S][revenue] FACT` — **Main product list omits `.lean()`/`.select()`** (`products.js:198`) — hydrates full docs then `toObject()`. _(attachRatings itself is correctly batched — not N+1.)_ **Fix:** `.lean().select(cardFields)`.
- `[MEDIUM][S][revenue] FACT` — **ProductCard hover image preloads full-res** (`ProductCard.tsx:96-102`). **Fix:** wrap in `cloudinaryUrl(hoverUrl, 400)`.
- `[LOW][M][revenue] JUDGMENT` — Admin finance/dashboard load full order docs and reduce in JS (`adminFinance.js:56-61,433-458`) — admin-only, no storefront impact. **Fix:** `$group` aggregations.
- `[LOW][S][maintainability] JUDGMENT` — Heavy deps are correctly route-isolated (recharts→admin dashboard, tiptap→admin journal, stripe→checkout). Confirm with bundle-analyzer; consider dynamic-importing Stripe Elements.

### 2.4 SEO

- `[HIGH][S][risk] FACT` — **Most legal/static pages omit canonical:** `/about, /contact, /returns, /shipping, /size-guide, /terms, /privacy-policy, /reviews` set title+description but no `alternates.canonical` (only `/faq`, `/gift-wrapping` declare one). Same "Duplicate without user-selected canonical" class the homepage fix addressed. **Fix:** add a self-referencing canonical to each.
- `[HIGH][S][risk] JUDGMENT` — **Journal articles have no canonical and no Article JSON-LD** (`journal/(public)/[slug]/page.tsx:28-39` sets OG only; listing has none). Indexable long-form with no structured data → no article rich results. **Fix:** add canonical + `Article`/`BlogPosting` JSON-LD.
- `[MEDIUM][S][risk] FACT` — **`?q=` search and unknown params fall through to the base `/shop` canonical** (`shop/page.tsx:62`) — thin/duplicate indexable pages. **Fix:** `robots: { index: false }` on search-result variants.
- `[MEDIUM][M][revenue] JUDGMENT` — **Product `aggregateRating` omitted until per-product reviews exist** (`product/[id]/page.tsx:196-213`) — correct anti-spam choice, but no PDP star snippet and a persistent GSC warning. **Fix:** link reviews to `productId` so ratings populate (this is the reviews gap below).
- `[MEDIUM][S][maintainability] FACT` — **Bundle/collection/shop pages emit no Product/ItemList/Offer schema** (only the PDP has it). **Fix:** add Product+Offer to bundles, ItemList to shop/collection grids.
- `[MEDIUM][S][risk] FACT` — **Sitemap omits collections, bundles, and individual journal articles** (`sitemap.ts:34-59` — static + product IDs + one `/journal` entry). **Fix:** append collection/bundle/journal slugs.
- `[LOW][S][maintainability] FACT` — Brand casing inconsistent: layout uses "Silkilinen", OG `siteName`/JSON-LD brand use "SILKILINEN". **Fix:** standardize on "Silkilinen".
- `[LOW][S][maintainability] FACT` — **Homepage has no `h1`** (hero is `h2`, `page.tsx:74`) and the hero LCP image has empty `alt` (`page.tsx:64-71`). **Fix:** promote hero to `h1`, add descriptive alt.

**Verified present:** homepage canonical, apex→www 301, `/privacy`→`/privacy-policy` 301, `/blog`→`/journal` 301 (`next.config.ts:34-57`, `page.tsx:20-22`); robots disallows `/admin//api/` with sitemap ref, no stray noindex. Product alt handling is correct (populated primaries, `aria-hidden` decoratives).

### 2.5 UX, accessibility & conversion

- `[HIGH][S][risk] FACT` — **Muted text fails WCAG AA contrast.** `var(--color-ink-muted) #8A8278` on `#FAF8F4` ≈ 3.0:1 (≈2.8:1 on cream fills) — below the 4.5:1 body minimum. Drives conversion-critical copy: ReassuranceRow sub, accordion sub-labels, PDP material/fit/stock text, size-guide link, StickyBuyBar price, ProductCard rating count, checkout labels, success page. **Fix:** darken the token to ~`#6B6358` or darker (verify ≥4.5:1).
- `[HIGH][M][risk] FACT` — **Gallery lightbox is keyboard-inaccessible.** `ProductGallery.tsx:151` opens via a plain `<div>` onClick; lightbox (`:205-222`) has no `role="dialog"`, no `aria-modal`, no Escape, no focus trap/restore. **Fix:** button trigger + dialog semantics + Escape + focus trap (mirror `CartPanel.tsx:94-138`).
- `[HIGH][S][revenue] JUDGMENT` — **No trust signals on the PDP near the buy action.** ReassuranceRow is homepage-only; PDP buries shipping/returns inside a collapsed accordion (`product/[id]/page.tsx:368`); StickyBuyBar shows only name+price+CTA. **Fix:** compact shipping/returns/secure/Donegal row under the CTA in `ProductOptions`.
- `[HIGH][S][risk] JUDGMENT` — **Fabricated "just sold" popup invents buyer identities.** `JustSoldPopup.tsx:6-11,40-50` pairs random first names + cities ("X from Dublin just bought"). Deceptive pattern, contradicts authentic Donegal positioning, UCPD/CPC exposure. **Fix:** show only genuinely attributable activity, or remove.
- `[HIGH][M][revenue] FACT` — **Email-capture popup auto-opens, no focus trap, fakes success on failure.** `EmailCapturePopup.tsx` (30s/50%-scroll/exit-intent, `autoFocus` steals focus, no Escape/trap; on network failure `:82-87` still shows "your code is on its way" and marks dismissed). **Fix:** Escape+trap+restore, gate success on a real 2xx, soften triggers.
- `[MEDIUM][S][risk] FACT` — **Popup/gallery touch targets below 44px.** Popup close ✕ ~24px/~12px (`EmailCapturePopup.module.css:33`, `JustSoldPopup.module.css:60`); gallery heart 36px (`ProductGallery.module.css:115-126`); page dots 6px with no enlarged hit area. **Fix:** 44×44 minimum.
- `[MEDIUM][M][risk] FACT` — **Two cookie-consent systems can both mount** (`CookieConsent.tsx` z-9000 + `CookieConsentBanner.tsx` z-9999), neither with proper dialog semantics; the z-9999 banner can cover the StickyBuyBar CTA on mobile. **Fix:** wire exactly one, use `role="region"`, audit bottom-fixed z-index.
- `[MEDIUM][S][revenue] JUDGMENT` — **"Notify when available" dumps into `mailto:`** (`ProductOptions.tsx:71-72`) — dead-end on devices without mail, captures nothing. **Fix:** inline back-in-stock email form.
- `[MEDIUM][S][maintainability] FACT` — **StickyBuyBar can overflow ~320px viewports** (name 180px + btn 150px + gaps > 320). **Fix:** flex-shrink the name.
- `[MEDIUM][S][risk] FACT` — **Collapsed mobile footer links stay keyboard-tabbable** (`Footer.module.css:124-128` max-height:0 but in tab order). **Fix:** `inert`/`visibility:hidden` when collapsed.
- `[MEDIUM][S][risk] FACT` — Low-stock urgency text `#b5631a` at 11px ≈ 3.6:1 (`product/[id]/page.module.css .stockLow`). **Fix:** darken to 4.5:1.
- `[LOW][S][risk] FACT` — Cart panel hardcodes "free shipping to Ireland" @ €150 regardless of destination (`CartPanel.tsx:142,260`). **Fix:** dynamic/generic label.
- `[LOW][S][brand] JUDGMENT` — **Confirmation page is thin** (`success/page.tsx` — generic checkmark, no order number/recap/ETA, muted copy). Misses a reassurance/cross-sell moment at peak trust. **Fix:** order number + summary + "you may also like".
- `[LOW][S][maintainability] FACT` — Gallery heart lacks `aria-pressed`; "no image" placeholder is silent to AT.

**Good (no action):** focus management in `CartPanel` and `SideMenu` is strong; product alt handling correct; typography system (Cormorant/EB Garamond/Jost) is coherent.

---

## 3. Prioritised action plan (ranked by impact ÷ effort)

> Do them roughly in this order. 1–8 are the high-leverage core.

1. **Replace the regex sanitizer with `sanitize-html` (server-side)** — closes the only CRITICAL security hole. _[security, M]_
2. **Image pipeline overhaul** — migrate storefront `<img>`→`next/image` (or add `srcSet`+`sizes`), and wrap every un-transformed URL in `cloudinaryAuto`. Biggest CWV + brand win. _[perf, M]_
3. **Fix the free-shipping promise** (€150 vs €200) and derive the shipping table + country lists from `backend/services/shipping.js`. Stops a live revenue/trust bug + three drift sources. _[code, M]_
4. **Escape all email templates** with `esc()` + **pin the customer JWT algorithm**. _[security, S]_
5. **Darken `--color-ink-muted`** to ≥4.5:1 — one token, fixes contrast funnel-wide. _[a11y, S]_
6. **Reviews = trust:** import Etsy reviews onto products + schedule the review-request cron (the existing `scripts/sendReviewRequests.js`). Unlocks per-product star snippets + the GSC `aggregateRating` warning. _[revenue/SEO, S–M]_
7. **PDP trust row + fix the popups:** add a shipping/returns/secure/Donegal row under the buy CTA; **remove the fabricated "just sold" popup**; gate the email-popup success on a real response + add a focus trap. _[revenue/risk, S–M]_
8. **Add canonicals** to all legal pages + journal articles; add **Article JSON-LD**; add collections/bundles/journal to the sitemap. _[SEO, S]_
9. Add `field allow-lists`/validation to public `products.js` writes; add a validation library. _[security, M]_
10. Switch shop/PDP/collection/bundle fetches from `no-store` to `revalidate: 60`. _[perf, S]_
11. Add the missing Mongo indexes (`isNewArrival`, `collections`, `bundles.categories`); `.lean()` the product list. _[perf, S]_
12. `git rm --cached backend/stripe.exe` + gitignore; `process.exit(1)` on DB connect failure. _[maintainability/risk, S]_
13. Gallery lightbox a11y (dialog + Escape + focus trap) and 44px touch targets across popups/gallery. _[a11y, S–M]_
14. Fix false empty-states (orders/customers/admin products) + guest-wishlist-loss-on-login. _[UX, S]_
15. Move policy copy (FAQ/returns/shipping/size-guide) + `hello@` + social `sameAs` into SiteContent/the social API. Consolidate the two cookie banners. Adopt or delete `lib/api.ts`. _[maintainability, M]_
16. Add integration tests for checkout/cart/orders (the money path). _[risk, M]_

---

## 4. Commands to run (for numbers I couldn't get statically)

```bash
# Core Web Vitals — mobile is the metric that matters
npx lighthouse https://www.silkilinen.com/        --form-factor=mobile --view
npx lighthouse https://www.silkilinen.com/shop    --form-factor=mobile --view
npx lighthouse "https://www.silkilinen.com/product/<real-id>" --form-factor=mobile --view
npx unlighthouse --site https://www.silkilinen.com   # site-wide CWV sweep

# Bundle analysis (storefront vs admin)
cd frontend && npm i -D @next/bundle-analyzer
# wrap next.config.ts with withBundleAnalyzer({ enabled: process.env.ANALYZE==='true' })
ANALYZE=true npm run build

# Confirm Cloudinary is actually serving AVIF/WebP
curl -sI -H "Accept: image/avif,image/webp,*/*" \
  "https://res.cloudinary.com/<cloud>/image/upload/w_400,c_fill,f_auto,q_auto/<asset>" \
  | grep -i 'content-type\|content-length'

# Contrast — verify the muted-token fix
# Use a tool (e.g. WebAIM Contrast Checker) for #8A8278 vs #FAF8F4 (≈3:1, fails) → target ≥4.5:1

# Dependency vulnerabilities (never run per the security report)
cd backend && npm audit --omit=dev
cd frontend && npm audit --omit=dev
```

---

## 5. Beyond the checklist

### Conversion ideas specific to luxury silk
- **Reviews are the single biggest gap.** A €150–200 robe with zero reviews reads as "untested." Import Etsy reviews + automate requests (already have the sender) → stars on cards, PDP snippets, and the trust a considered buyer needs.
- **Fabric & fit confidence.** You now have `momme`/`fitNote` fields — fill them ("22-momme Mulberry silk", "model is 5'9", wears S"). Add a macro fabric shot per hero product. This is what justifies the price.
- **Care = longevity = value.** Surface your silk-care journal content as a PDP "Fabric & care" panel; "lasts for years, hand-wash cool" turns price into investment.
- **Gifting flow.** Drop-a-Hint and the gift-wrapping page exist but are under-promoted — add a "Gift" entry point and gift-note preview; gifting is a huge silk-intimates use case.

### Differentiation vs Olivia von Halle
- **Make Irish light a structural product feature, not just imagery.** "Shot in Donegal," named locations, seasonal golden-hour drops — OvH is studio-polished; your natural-light, landscape-rooted identity is a genuine wedge if it shows up in the *experience* (location tags on shoots, a "from Donegal with love" provenance strip, a map/story per collection).
- **Provenance as proof.** "Designed in Dublin, crafted by artisans, dispatched from Donegal" on the PDP is both brand and trust.

### Editorial & content leverage
- The **Grand Tour origin story, silk glossary, and the Scota/harp myth** are ready-made on-site experiences that also feed SEO. Turn the glossary into an interlinked `/journal` hub (each term a thin landing page targeting "what is momme silk", "mulberry vs charmeuse"), and link articles bidirectionally with PDPs. This compounds the long-tail traffic a new domain badly needs.

### Technical leverage you're not using
- You already have a **Gemini integration + `aiText`/`aiPhotos` services.** Cheap, high-value applications: (1) auto-generate per-product `metaTitle`/`metaDescription`/`altText` (fixes the SEO + a11y gaps at scale), (2) a **fabric/care Q&A + size assistant** on the PDP, (3) a **gift finder** ("silk gift for a new mum under €100"). These reuse infrastructure you've already paid for.

### The honest big-picture take (as your founder advisor)
**The 3 things that matter most right now:**
1. **Trust → reviews.** Nothing converts a hesitant first-time luxury buyer like real reviews. Import + automate. _(highest ROI, lowest effort)_
2. **Images → next/image + Cloudinary transforms.** Your brand promise is "bright, luminous silk" and your biggest perf lever is the same fix. Do both at once.
3. **Honesty in the funnel.** Fix the €150/€200 shipping promise, kill the fake "just sold" popup, stop the email popup faking success, and fix the contrast. These are small but they're the difference between "premium" and "looks premium until you look closely."

**The tempting distraction to ignore:** building more AI features or further reworking the admin dashboard before the above are done. The dashboard is already good enough; the storefront's trust + images + honesty are where the money is.

---

_Generated by a code-level audit. Items marked "needs a runtime tool" (Lighthouse numbers, `npm audit`, exact contrast ratios, the journal-SSR root cause) require running the commands in §4 to confirm._
