# SILKILINEN Audit-Fix Brief

**For:** A fresh Claude Code session
**Branch:** `claude/audit-fixes-RRVLV` (create from `master`)
**Goal:** Fix every finding from the full-stack audit. Small focused commits, one logical change per commit. Push at the end.

---

## Ground rules

1. **Do not break the public API contract.** Frontend calls these endpoints today — response shapes must stay compatible unless a fix explicitly requires changing them (in which case update both sides in the same commit).
2. **No speculative refactoring.** Only touch what each finding requires. The audit identified bloat in `routes/adminProducts.js` (883 LOC) and `services/email.js` (532 LOC) — leave them unless a fix forces a change.
3. **No new dependencies beyond those listed below.** Approved additions: `helmet`, `pino`, `pino-http`, `csurf` (only if you go that route — see F8), `vitest`, `supertest`.
4. **Commit per finding** with message `fix(area): F<n> short description`. This makes review tractable.
5. **Verify each fix** with the acceptance check before moving on. If you can't verify, say so in the commit body.
6. **No tests written for trivial fixes** (e.g., adding helmet). Tests required for: checkout flow, auth flow, admin product CRUD.

---

## Pre-flight

```bash
cd /home/user/SILKILINEN
git checkout master && git pull
git checkout -b claude/audit-fixes-RRVLV
cd backend && npm ci
cd ../frontend && npm ci
```

Confirm dev servers start cleanly before changing anything.

---

## CRITICAL

### F1 — Add helmet + security headers to backend
- **File:** `backend/server.js`
- **Fix:** `npm i helmet` in `backend/`. Add `const helmet = require('helmet'); app.use(helmet());` immediately after `app` is created, before any route mounting. Configure CSP only if frontend breaks — start with defaults.
- **Verify:** `curl -I http://localhost:5000/api/health` shows `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.

### F2 — Remove JWT_SECRET fallback, fail-fast
- **File:** `backend/server.js:3-8`
- **Fix:** Delete the `|| DEFAULT_SECRET` fallback. At boot, if `process.env.JWT_SECRET` is missing, log and `process.exit(1)`. Same for `JWT_CUSTOMER_SECRET` if used.
- **Verify:** Boot with `unset JWT_SECRET && node server.js` → exits with clear message. Boot with secret set → starts normally.

### F3 — Rate-limit checkout, signup, password-reset
- **Files:** `backend/routes/checkoutV2.js:67`, `:176` (create-intent, update-intent); `backend/routes/auth.js` login; `backend/routes/customers.js` signup + magic-link.
- **Fix:** Import existing `authRateLimit` (or define a stricter `checkoutRateLimit`, e.g. 10/min/IP) from `middleware/rateLimits.js` and apply to the routes above. **Do not** rate-limit the Stripe webhook (Stripe retries).
- **Verify:** Hammer create-intent 20× in 60s with curl → 429s after threshold.

### F4 — Stop returning JWT in `/auth/login` response body
- **File:** `backend/routes/auth.js:63`
- **Fix:** Remove `token` from `res.json({ success: true, token })`. The httpOnly cookie is the only delivery.
- **Verify:** Frontend admin login still works (`app/admin/login/page.tsx` uses `credentials: 'include'`, not the body token). If frontend reads `data.token` anywhere, grep and remove — should be unused.

### F5 — Sanitize journal preview HTML
- **File:** `frontend/app/journal/preview/page.tsx:74`
- **Fix:** Mirror the pattern from `app/journal/[slug]/page.tsx:85` — wrap body in `DOMPurify.sanitize(article.body)` before `dangerouslySetInnerHTML`.
- **Verify:** Paste `<img src=x onerror=alert(1)>` in a draft → preview renders inert `<img>`.

### F6 — Graceful shutdown
- **File:** `backend/server.js:120-137`
- **Fix:** Capture `const server = app.listen(...)`. Add `process.on('SIGTERM', shutdown)` and `process.on('SIGINT', shutdown)`. `shutdown()` should: stop accepting new conns (`server.close()`), clear any `setInterval` used by `processCartRecovery` (track the interval ID), `await mongoose.connection.close()`, then `process.exit(0)`. Add a 10s hard-exit fallback.
- **Verify:** `kill -TERM <pid>` → logs "shutting down", no orphaned Node process, Mongo connection closed.

### F7 — Central error middleware + remove duplicate try/catch
- **Files:** `backend/server.js` (add middleware), all routes (simplify).
- **Fix:**
  1. Add at the end of `server.js`, after all routes:
     ```js
     app.use((err, req, res, next) => {
       req.log?.error({ err, path: req.path }, 'unhandled');
       const status = err.status || 500;
       res.status(status).json({ error: err.expose ? err.message : 'Internal server error' });
     });
     ```
  2. In route files, convert handlers to `async (req, res, next) => { ... }` and `next(err)` on catch instead of duplicating the `console.error + 500` pattern. Do this incrementally — **start with `adminProducts.js`, `checkoutV2.js`, `auth.js`** (highest-traffic). Leave other route files for a follow-up commit; note remaining in the commit body.
- **Verify:** Force an error (e.g. malformed ObjectId) → JSON `{error: "Internal server error"}`, no stack trace, structured log line.

---

## HIGH

### F8 — CSRF + tighten SameSite
- **Files:** `backend/routes/auth.js:55`, `backend/routes/customers.js:17`, `backend/server.js`.
- **Decision required** — pick one and document in commit:
  - **Option A (preferred if admin is on same domain as API):** change admin cookie to `sameSite: 'strict'`, customer to `'lax'`. No CSRF middleware needed. Verify frontend admin still authenticates.
  - **Option B (if cross-origin must stay):** keep `sameSite: 'none'` but add CSRF tokens. Use `csurf` or a double-submit cookie pattern. Exclude the Stripe webhook route.
- **Verify:** Admin login + a sample POST (e.g. create product) still works after the change. From a different origin, the request is rejected.

### F9 — CORS allowlist from env, drop preview URLs
- **File:** `backend/server.js:61-79`
- **Fix:** Read `CORS_ORIGINS` env var (comma-separated). Remove hardcoded Vercel preview URLs. Keep `https://silkilinen.com` and `https://www.silkilinen.com` as defaults if env is empty in prod.
- **Verify:** `CORS_ORIGINS=https://silkilinen.com node server.js` → curl from disallowed origin gets blocked CORS preflight.

### F10 — Catch fire-and-forget promises
- **Files:** `backend/routes/adminProducts.js:49-57` (SEO), `backend/routes/checkoutV2.js:361` (Meta CAPI).
- **Fix:** Wrap each unawaited call: `fireMetaCapi(...).catch(err => req.log?.error({err}, 'capi failed'))`. No queueing — out of scope. Just stop the silent swallow.
- **Verify:** Force the AI service to fail → error appears in logs, request still returns 200.

### F11 — Schema validation: Product name + price
- **File:** `backend/models/Product.js:36`, `:price-field`
- **Fix:** Change `required: false, default: ''` on `name` to `required: true, minlength: 1`. `price` to `required: true, min: 0`. Run a migration script (add to `scripts/`, idempotent — only touches docs missing these fields, logs count). **Do not run** the migration — leave it for the human to run with a flag, document in commit body.
- **Verify:** Try to save a product with empty name in a unit test (write one — `models/Product.test.js`) → throws ValidationError.

### F12 — Checkout transaction
- **File:** `backend/routes/checkoutV2.js` (order creation handler around `:243+`)
- **Fix:** Wrap the Mongo writes that create the order + decrement stock + create receipt in a `mongoose.startSession()` transaction. Abort on any failure. Note: requires Mongo replica set — Atlas has this by default.
- **Verify:** Add a test that simulates stock-update failure → order is not created.

---

## MEDIUM

### F13 — Sanitize AnnouncementBar
- **File:** `frontend/components/AnnouncementBar.tsx:36`
- **Fix:** If `messages` come from CMS/admin, wrap with `DOMPurify.sanitize(msgs[index])`. If they're always hardcoded constants, replace `dangerouslySetInnerHTML` with plain children + allow `<strong>` via a tiny manual renderer.
- **Verify:** Render with `<script>alert(1)</script>` → inert.

### F14 — Escape tracking pixel IDs
- **Files:** `frontend/components/MetaPixel.tsx:41`, `frontend/components/PinterestTag.tsx:36`
- **Fix:** Before embedding, `const safeId = String(PIXEL_ID).replace(/[^a-zA-Z0-9_-]/g, '')`. Use `safeId` in the template.
- **Verify:** Set env var to `"); evil(); //` → page loads with stripped ID, no script injection.

### F15 — Multer magic-byte file-type check
- **File:** `backend/routes/aiPhotos.js:18-34`
- **Fix:** After upload, read first 12 bytes of buffer, match against JPEG/PNG/WebP signatures. Reject mismatches with 400. Don't add a library — short helper inline.
- **Verify:** Rename `evil.exe` to `evil.jpg`, upload → 400.

### F16 — Centralize frontend API client
- **File (new):** `frontend/lib/api.ts`
- **Fix:** Single wrapper around `fetch` that: prepends `NEXT_PUBLIC_API_URL`, sets `credentials: 'include'`, throws on non-2xx with parsed body. Migrate callers **only where you touch them for other fixes**. Don't rewrite all 70 fetches — leave a TODO comment listing remaining call sites.
- **Verify:** A migrated page still works in dev.

### F17 — Structured logger
- **Fix:** `npm i pino pino-http` in backend. Replace `console.log/error` in: `server.js`, the 3 routes refactored in F7, and `services/email.js`. Use `req.log` in handlers. Leave the rest with a TODO; full conversion is out of scope.
- **Verify:** Log lines are JSON with timestamps, request IDs.

### F18 — Minimal test harness
- **Fix:** `npm i -D vitest supertest` in backend. Add `"test": "vitest"` to package.json. Write tests for:
  - `auth.js` login happy path + bad password
  - `checkoutV2.js` create-intent validation
  - `adminProducts.js` create + update with allowlist
  - F11 schema validation
  - F12 transaction rollback
- **Verify:** `npm test` passes.

### F19 — Migration idempotency markers
- **File (new):** `backend/scripts/_lib/migrations.js`
- **Fix:** Tiny helper that records a migration name in a `migrations` collection after success. Wrap `migrateProductsToVariants.js` and `updateAiModelPromptsV2.js` to skip if already run. Don't touch the others.
- **Verify:** Run twice → second run logs "already applied, skipping".

---

## LOW (do only if time permits, otherwise skip and note in PR)

- F20: Add explicit bcrypt salt rounds constant
- F21: Add `timestamps: true` to `AiModel.js`, `User.js`
- F22: Constant-time compare for magic-link tokens (`crypto.timingSafeEqual`)
- F23: Add ESLint a11y plugin to frontend, fix surfaced issues only

---

## Out of scope (do NOT do)

- Splitting the 1,279-line admin product page
- Splitting `services/email.js` / `services/auditAgents.js`
- Adding memoization to `ProductGallery`/`CartPanel`/`SideMenu`
- Replacing all `console.log` calls
- Migrating all `fetch()` calls to the new API client
- Anything related to the VPS migration itself

Mention these in the PR body as known follow-ups.

---

## Done definition

- All Critical + High fixed and verified locally
- All Medium attempted; any skipped are listed in PR body with reason
- `npm test` green in backend
- Both servers boot cleanly (`backend: node server.js`, `frontend: next dev`)
- A manual smoke test passes: admin login, create a product, customer signup, add to cart, create checkout intent (do not complete payment)
- Commits pushed to `claude/audit-fixes-RRVLV`. **Do not open a PR** unless explicitly asked.

---

## Reference

Original audit findings live in this conversation's history. The three source reports cover: backend security, backend architecture/quality, frontend. If a finding here is ambiguous, the source audit has more detail — re-read it before guessing.
