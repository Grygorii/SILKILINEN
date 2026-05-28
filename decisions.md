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

# [next] — Title
Date: YYYY-MM-DD

**Chose:**
**Over:**
**Because:**
**Reusable for:**
**Code:**
**Watch out:**
