# SILKILINEN — Gotchas

Things that have bitten us before. Read before debugging anything that looks like one of these.

## The Agent Garden — who does what (read before adding an agent or orchestrator)

**Specialist agents** live in `services/growthAgents/` and are registered in `services/growthEngine.js`. Their registry `name` is SHORT and often differs from the file/label — the real names are: `demand, competitor, storefront, eureka, prometheus, maui, content, social, newsletter, hermes, watchdog, logicClerk, reasoningClerk`. **Always key maps/links on the registry `name`, not the filename** (this bit the Marketing Coordinator's `AGENT_HOME`).

**Four orchestrators — keep their mandates separate:**
- `growthEngine.js` — the **scheduler**. Runs due agents on cadence, logs each as a GrowthAction. Doesn't think.
- `chiefOfStaff.js` — the **weekly state of the business** (measure → attribute → learn → decide brief). Owns the AI Star (North Star). Writes the Playbook via `mergeLearnings` (merge, NOT overwrite — see below).
- `marketingCoordinator.js` — **goal-driven delegation**. Takes a brief, picks specialists, composes one `MarketingPlan`, verifies it.
- `davinci.js` — **on-demand 90-day symphony** (force-runs the engine + a brief + a quarter plan). Overlaps the above by design; use it for the big-picture quarter, not weekly ops.

**The learning loop must MERGE, not overwrite.** Chief distils weekly learnings; Hermes and the clerks `addLearning()` incrementally. Chief writes via `playbook.mergeLearnings` so it prepends without wiping the agents' running entries. Never switch Chief back to `setLearnings` (that silently erased Hermes/clerk learnings every week — fixed 17 Jun 2026).

**The clickstream feeds the brain.** The first-party Event stream (funnel, on-site searches, clicks) is read via `services/clickstream.js` `getClickstreamSignals()` and surfaced in `chiefOfStaff.measure()` (so both Chief and Coordinator see it). If you add a new brain that should reason over on-site behaviour, read it from there — don't leave it an island.

**Two SEO planes, intentionally separate:** `auditAgents.runSeoHygieneAgent` (on-page HTML hygiene → Site Audit UI / advisor digest) vs `hermes` (search strategy → SEO Recommendations). They don't share findings on purpose; don't "unify" them without a reason.

## Regression guard — how we remember fixes

**Every bug we fix should become an automated check, so it can't silently come back.** Don't rely on memory or a one-off manual test. The pattern:

1. Fix the bug.
2. Encode the rule that would have caught it as a check in the nearest **agent that already runs against the live system**, so a future run re-verifies it:
   - **On-page SEO / HTML hygiene** (missing meta description, image alt, title length, multiple `<h1>`, …) → `backend/services/auditAgents.js` → `runSeoHygieneAgent` (Admin → Site Audit → the **On-page SEO** agent). Add a rule to `auditPageHtml`.
   - **Infra / SEO / Merchant live status** → `backend/routes/adminSeoHealth.js` (Admin → SEO → Overview).
   - **Cross-surface / data consistency** → `auditAgents.js` → `runConsistencyAgent`.
3. Note the class of bug here so a human/agent knows the guard exists.

**Logged regressions (each now has an automated check):**
- *Merchant card said "24/24 disapproved" while Google said approved* — counted per-destination disapproval as product disapproval. Fixed in `merchantCenter.js`; guarded by the Merchant live-status check.
- *External crawler (17 Jun 2026): missing meta description, 31 images without alt, 6 over-long titles, 2 pages with >1 `<h1>`* — fixed PDP title (absolute metaTitle) + ProductGallery alt fallback. All four classes now re-checked every run by the **On-page SEO** audit agent, which reports the exact offending URLs.

## Infrastructure

**Railway Railpack BuildKit bug.** Backend deploys break on default Railpack builder. Workaround: `backend/railway.toml` forces Nixpacks. Remove this file once Railway fixes the underlying bug.

**Rate limiter behind reverse proxy.** Must call `app.set('trust proxy', 1)` in Express or the rate limiter sees Railway's proxy IP for every request and either locks out everyone or no one. Already set; don't remove.

**Rate limiter and 5xx responses.** Configured 5xx-aware (`requestWasSuccessful + skipFailedRequests`) so customers don't get locked out during an infra outage. Don't "simplify" this.

**Resend health check.** Uses configuration validation, not a live API call. The send-only API key cannot list domains, so a live check fails. If you change this, the health check will break.

**`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** belongs on **Vercel only**, not Railway. Currently redundantly set on Railway — delete when convenient.

**`GOOGLE_CLIENT_ID` is critical.** Required for Google OAuth. Set in Railway. As of 28 May 2026, `backend/routes/customers.js` fails closed if the env var is unset (returns 503) and validates both `aud` and `iss` claims. If you ever fork or duplicate this route in a new auth flow, replicate the fail-closed guard — the original code shipped with a fail-open bug for two weeks (audit H2).

## Frontend

**iOS Safari body scroll lock.** `document.body.style.overflow = 'hidden'` is ignored by iOS Safari during touch events. The working pattern is `position: fixed` + saved `scrollY` + restore on close. Used in `SideMenu` and `CartPanel`.

**`addEventListener` with `{ passive: false }` for swipe handlers.** React synthetic `onTouchMove` doesn't allow `preventDefault()`. Use native `addEventListener('touchmove', ..., { passive: false })` from a `useEffect` and clean up on unmount.

**Sticky panels in CSS Grid.** `position: sticky` only works on a grid item if `align-self: start` is also set. Forgetting this is why the product page sticky kept breaking.

**Next.js root layout `<head>` triggers spurious preload warnings.** A `<link rel="stylesheet">` inside `layout.tsx`'s `<head>` makes Next auto-generate a `<link rel="preload" as="style">` the browser can't always consume in time. Move font imports to `@import` in `globals.css` instead.

**Empty image URL = broken icon, not nothing.** A `<img src="">` renders the broken-image icon. Components must filter with `isValidImageUrl()` from `frontend/lib/imageUtils.ts` before rendering OR have an `onError` handler that hides the element.

**`middleware.ts` will be deprecated in Next.js 16.** Rename to `proxy.ts` when upgrading. Not blocking now.

## Backend

**Cloudinary URL hardening.** The `/api/admin/products/:id/images/url` endpoint validates `url.includes('res.cloudinary.com')`. The original bug was admins pasting Gemini chat URLs (which return HTML, not images) into image fields. Don't relax this check.

**Cloudinary upload errors carry `err.http_code`.** Return 502 with `err.message` so the admin UI shows the real failure ("Invalid API key", "Resource not found") instead of a generic 500.

**Mongoose duplicate-index warnings on `Product.slug`, `Customer.email`, `Customer.googleId`.** Cosmetic, not affecting functionality. Don't chase these without understanding the schema first — both `index: true` and a separate `schema.index()` call are present and it's not always wrong.

**Stripe webhook events.** Register `STRIPE_WEBHOOK_SECRET` in Railway pointing at `POST /api/webhook` with these events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.succeeded`. `charge.succeeded` is needed to capture `balance_transaction.fee` for Finance tab.

**`Visit.convertedToOrder` must be written by checkout webhook.** If you add a new checkout path, write `Visit.updateMany({ sessionId }, { convertedToOrder: order._id })` after `Order.create` or dashboard conversion rates silently break.

**Order total invariant:** `total = subtotal − discountAmount + shippingCost`. The persisted `order.total` already includes shipping. **Never re-add shipping in display code.** The orders list bug burned us twice.

**COGS snapshot at order time, not order display time.** `order.costs.cogs` is computed from `product.costing.totalUnitCost × qty` at checkout. If a product has no costing data, `order.costs.cogs = null` (never assume zero — finance reporting depends on this distinction).

**AiPhotoshoot `finalize()` does NOT auto-route photos to slots.** Only individual `approvePhoto()` does. If you build a bulk-approve path, replicate the slot routing.

**Microsoft Clarity is firing from somewhere.** Origin not confirmed. Investigate before enabling any paid-ads pixels — risk of contaminated attribution.

## AI / images

**Gemini chat URLs (`gemini.google.com`) are not image URLs.** They return HTML. Filtered at three layers now: `isValidImageUrl` on the frontend, server-side rejection in `/api/admin/products/:id/images/url`, audit script (`backend/scripts/auditBrokenImages.js`) for catching legacy data. Don't relax any of these.

**Audit script has two modes:**
- `node scripts/auditBrokenImages.js` — pattern check only (fast)
- `node scripts/auditBrokenImages.js --verify` — also HEAD-checks every Cloudinary URL (slow, catches assets deleted from the Cloudinary dashboard)

## Bookkeeping
- `THUMBNAIL` slot does not have a named slot card. Thumbnail images live in Additional images. Future work: auto-derive from HERO via Cloudinary transform.
- Old `convertedToOrder` data from the pre-fix code version is stale; dashboard aggregation now uses `$lookup` against Orders by `browserSessionId` instead, so historical data is corrected without a migration.
