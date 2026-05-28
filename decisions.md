# SILKILINEN — Decisions Log

Lightweight architecture decision record. After every meaningful choice, add an entry. The "Reusable for" line is what makes this an agency asset — keep filling it in.

**Format:**
```markdown
# NNNN — Short title
Date: YYYY-MM-DD

**Chose:** What we did.
**Over:** What we considered and didn't pick.
**Because:** Why.
**Reusable for:** Which kinds of clients/projects would land here too.
**Code:** Paths to actual implementation.
**Watch out:** The trap, if any.
```

---

# 0001 — Magic-link + Google OAuth for customers, JWT for admin
Date: 2026-05-01

**Chose:** Magic-link via email + Google OAuth for customers. JWT (HS256) for admin sessions.
**Over:** Passwords for both, single auth scheme for both, full session DB.
**Because:** Customer auth needs to be frictionless (lowest possible drop-off at checkout). Admin auth needs to be revocable and have a different threat model — there are only 1–3 admin users ever. JWT keeps admin stateless and easy to invalidate by rotating `JWT_SECRET`.
**Reusable for:** Any e-commerce client where admin headcount is small and customer volume is large. Don't use this pattern for B2B SaaS where customer = admin (single role).
**Code:** `backend/routes/customers.js`, `backend/routes/auth.js`, `backend/middleware/auth.js`
**Watch out:** Google OAuth `aud` check originally failed open if `GOOGLE_CLIENT_ID` was unset — fixed 28 May 2026 with a fail-closed guard plus `iss` validation (audit H2 + L1). `algorithms: ['HS256']` now pinned on `jwt.verify` (audit M1). If you build a new auth handler, replicate both patterns — they're the canonical shape for this codebase.

---

# 0002 — Cloudinary as the only legal image host
Date: 2026-05-15 (consolidated, exact date varies by fix)

**Chose:** All product/journal images must be uploaded through `upload_stream` and live at `res.cloudinary.com`. Validated server-side at the route, frontend, and via audit script.
**Over:** Accepting any URL the admin pastes in.
**Because:** Admins were pasting Gemini chat session URLs (which return HTML, not images) into image fields. Result: products with broken-image icons. The fix is enforced at three layers because once is not enough.
**Reusable for:** Any client where non-technical staff edit content with images. Lock the URL pattern at the backend; do not trust frontend validation alone.
**Code:** `backend/routes/adminProducts.js` (`url.includes('res.cloudinary.com')` check), `frontend/lib/imageUtils.ts`, `backend/scripts/auditBrokenImages.js`
**Watch out:** Direct deletion from Cloudinary dashboard can still create 404s. Run `--verify` mode of the audit script periodically.

---

# 0003 — Stripe Payment Intents (v2) replacing checkout sessions (v1)
Date: 2026-05-16

**Chose:** Payment Intents with embedded Elements at `/checkout`. Custom webhook handler at `POST /api/webhook`.
**Over:** Stripe Checkout (hosted page).
**Because:** Hosted Stripe Checkout limited UX customization (address layout, discount UX, country preview). Embedded Elements gives full control of the checkout page while Stripe handles PCI scope. Webhook handler can do CAPI + Visit attribution + COGS snapshot + email send in one place.
**Reusable for:** Any e-commerce client wanting branded checkout and rich post-purchase attribution.
**Code:** `frontend/app/(shop)/checkout/page.tsx`, `backend/routes/checkoutV2.js`
**Watch out:** Order total invariant `total = subtotal − discountAmount + shippingCost` — `order.total` already includes shipping, never re-add it in display code.

---

# 0004 — Cookie consent gates ALL non-essential scripts
Date: 2026-05-16

**Chose:** Single `CookieConsentContext` with three per-category prefs (functional, analytics, marketing). Banner + settings modal. Equal-weight Accept All / Reject All.
**Over:** Banner-only ("Accept" or nothing) approaches that fail GDPR / Irish DPC guidance.
**Because:** Irish DPC requires a rejection path no harder than acceptance. Per-category gating future-proofs us — when we add new tools we just attach them to a category, not to a yes/no global.
**Reusable for:** Any EU-targeting consumer site. Likely all of them.
**Code:** `frontend/context/CookieConsentContext.tsx`, `frontend/components/CookieConsentBanner.tsx`, `frontend/components/CookieSettingsModal.tsx`
**Watch out:** Meta CAPI server-side is allowed without frontend consent because it's an explicit Purchase event the user just made — but document this if it ever gets questioned.

---

# 0005 — Donegal in depth, Ireland on the surface (copy layering)
Date: 2026-05-14

**Chose:** Announcement bar says "Ireland". Product pages, emails, story copy, AI image prompts, footer say "Donegal".
**Over:** Unifying everything to "Ireland" (broad) or "Donegal" (specific).
**Because:** International visitors recognize "Ireland" instantly. "Donegal" rewards the visitor who reads further with specificity and authenticity. Pretending the difference is a bug invites someone to "fix" it.
**Reusable for:** Any brand with a specific origin city/region inside a recognizable country. Layer broad → specific from surface to depth.
**Code:** Across copy. Not a code change.
**Watch out:** A QA pass that "normalizes" the copy. Document this in `brand.md` so future contributors know it's intentional.

---

# 0006 — Defense-in-depth on user-touchable HTML surfaces
Date: 2026-05-28

**Chose:** Three patterns applied across the codebase for any place user-supplied content reaches an HTML surface:
  1. Stored content rendered via `dangerouslySetInnerHTML` must pass through `DOMPurify.sanitize()` (`isomorphic-dompurify`).
  2. Email templates interpolate user input only through an `esc()` helper that escapes `&`, `<`, `>`, `"`, `'`, `/`.
  3. URL attributes in HTML are validated against an `^https?://` allowlist; non-matching values render as `#` or empty string.

**Over:** Trusting input validation alone, or blocklist-based escaping.
**Because:** Audit H1 and H3 both originated from "the input is from an admin, so it's safe" assumptions. Admin accounts get compromised. The fix has to be at the render layer, not the input layer.
**Reusable for:** Every client project. Especially any with an admin-authored content surface (CMS, journal, product descriptions, transactional emails).
**Code:** `frontend/app/journal/[slug]/page.tsx` (DOMPurify), `backend/services/email.js` (`esc()` helper + URL allowlist).
**Watch out:** If you swap `dangerouslySetInnerHTML` for a renderer that takes structured input (e.g. Tiptap's React renderer), DOMPurify becomes redundant — but only if the renderer is genuinely structured, not just `innerHTML` with extra steps.

---

# 0007 — Mass-assignment allowlist on admin write routes
Date: 2026-05-28

**Chose:** Admin routes that accept JSON bodies for create/update use an explicit `ALLOWED_FIELDS` constant + `pickFields(req.body)` helper. Stripped fields logged via `console.warn` so we see attempted overreach.
**Over:** Spreading `...req.body` directly (the original pattern), or `Object.assign(model, req.body)`.
**Because:** Admin authentication doesn't make the input trustworthy. A compromised admin session or a future bug exposing the route still can't escalate by writing arbitrary fields. Logging stripped fields catches both bugs (typos in legitimate frontend) and intrusion attempts (unexpected field names).
**Reusable for:** Every admin write route in every project.
**Code:** `backend/routes/adminProducts.js` (`PRODUCT_ALLOWED_FIELDS`, `pickProductFields`).
**Watch out:** When adding a new field to the model, you have to add it to the allowlist too. The save-with-no-error-but-field-doesn't-persist symptom is the signature of a missing allowlist entry. The `console.warn` log catches this — check server logs when "save isn't sticking" reports come in.

---

# 0008 — Sensory motion via pure CSS + a single IntersectionObserver, not Framer Motion
Date: 2026-05-28

**Chose:** Implement the sensory motion layer (sheen, lift, press, reveal, add-to-bag delight) with CSS tokens, CSS transitions, CSS keyframes, and one ~30-line `useReveal` hook backed by a single shared `IntersectionObserver`. Centralise the add-to-bag confirmation via the existing `cartItemAdded` custom event already dispatched by `CartContext`. Disable everything cleanly under `prefers-reduced-motion: reduce`.

**Over:** Framer Motion (or a hybrid where Framer drives only the delight moment). Framer would have been the conventional pick for orchestrated UI motion.

**Because:**
1. **Existing precedent.** The codebase already has explicit "no animation library" discipline — keyframes live in module CSS, transitions consume the `--t-*` / `--ease` tokens, the v1 design system was designed flat-and-quiet. Adding Framer would create one corner of the app with a different mental model from the rest.
2. **Bundle.** Framer Motion is ~30–55 KB gzipped client-side, with limited tree-shaking. Mobile-first traffic; that's a real tax. Pure CSS adds 0 KB.
3. **No gesture needs.** Framer's superpower is gesture-driven animation (drag, spring, layout transitions). None of the five behaviours need that. Hover, active, intersection, and a one-shot keyframe on an event are all trivially CSS.
4. **`prefers-reduced-motion` is one-liner CSS** (`@media (prefers-reduced-motion: reduce) { ... transition: none; animation: none; }`). Framer requires `useReducedMotion()` calls and conditional variants throughout.
5. **The delight isn't actually orchestrated.** It looks like a timeline (button breathes, wisp rises, cart pulses) but those three keyframes start at the same moment and run independently. No sequencing logic needed — the existing `cartItemAdded` event is the single trigger; three CSS classes do the rest.

**Reusable for:** Every client project where the visual identity is editorial / quiet / restrained. Especially e-commerce with mobile-heavy traffic where bundle weight matters and brand asks for refined motion, not bouncy/playful motion. The pattern — token block → primitives consume tokens → reveal via one shared IO singleton → delight via a single custom event listener — generalises cleanly.

**Code:** `frontend/app/globals.css` (token block + reveal classes + reduced-motion overrides), `frontend/lib/useReveal.ts` (IO singleton + hook), `frontend/components/ui/SilkImage.{tsx,module.css}` (sheen, video-ready), `frontend/components/CartDelight.module.css` (cart icon pulse + silk wisp), `frontend/components/Navbar.tsx` (event listener, debounced 600ms). PRESS lives directly in the three primitives' module CSS so it's inherited site-wide.

**Watch out:**
- **CSS Modules scope keyframe names.** Defining `@keyframes silki-breath` inside three different `*.module.css` files creates three separately-scoped keyframes with the same visual result. Don't try to share one across modules by name — that's a global lookup CSS Modules doesn't reliably do. Globals.css is the only place where a keyframe is genuinely global.
- **`prefers-reduced-motion` must be tested by hand.** TypeScript and the build won't catch a missing `@media (prefers-reduced-motion: reduce) { ... }` block. Every new motion behaviour needs an explicit override; without it, motion-sensitive users get the full sweep. Treat it as non-negotiable test-pass before shipping new motion.
- **Reveal flash trap.** If you add the `.revealing` class unconditionally on mount, above-the-fold content briefly renders visible, then ducks down, then animates back in — a "jump" the user sees. `useReveal` avoids this by checking `getBoundingClientRect()` on mount and skipping the class entirely for elements already in/above the viewport. If you ever swap this hook for a different reveal mechanism, replicate that check.
- **Re-triggering one-shot CSS animations.** Adding a class that has `animation: foo 600ms` once plays the animation. Removing then re-adding the class in the same React batch may not replay. Patterns that work: (a) `key` on the animating element (forces remount), (b) mount-on-condition (the wisp pattern — `{active && <span/>}`), (c) double-rAF off-then-on. For the cart icon pulse here, the listener uses `setDelightActive(false)` after 700ms before any next event can fire (debounce is 600ms, so by next event the class is gone), but the button's `key={delightKey}` is the belt to the suspenders.
- **`mix-blend-mode: screen` on sheen** lightens whatever is under it. Looks beautiful on darker product imagery, less visible on already-light fabric. Acceptable for v1; if a product image is near-white, the sheen is barely perceptible there. Real fabric video (later) will solve this naturally.

---

# [next] — Title
Date: YYYY-MM-DD

**Chose:**
**Over:**
**Because:**
**Reusable for:**
**Code:**
**Watch out:**
