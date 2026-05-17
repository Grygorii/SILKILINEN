# SILKILINEN — Security Audit Report

**Site:** silkilinen.com
**Stack:** Next.js (Vercel) + Express (Railway) + MongoDB Atlas + Stripe + Resend + Cloudinary + Gemini
**Audited:** May 2026 · **Fixes deployed:** May 2026
**Auditor:** Claude Code (full-codebase static audit)

---

## Status — all closed ✅

12 of 12 findings resolved and deployed to production over a single working session.

| # | Severity | Title | Status |
|---|----------|-------|--------|
| H1 | HIGH | Stored XSS in journal articles | ✅ Closed — DOMPurify sanitization deployed |
| H2 | HIGH | Google OAuth audience check fail-open | ✅ Closed — fail-closed code shipped; env var confirmed set |
| H3 | HIGH | HTML injection in Drop a Hint emails | ✅ Closed — `esc()` helper + URL allowlist |
| M1 | MEDIUM | JWT verify missing explicit algorithm | ✅ Closed — `{ algorithms: ['HS256'] }` pinned (library was already on safe v9.0.3) |
| M2 | MEDIUM | Admin JWT in response body | ✅ Closed (reclassified) — verification added to `/api/admin-session`; architecture already mitigated worst case |
| M3 | MEDIUM | Admin proxy only checks cookie presence | ✅ Closed — JWT format validation added |
| M4 | MEDIUM | Missing HTTP security headers | ✅ Closed — four headers shipped via `next.config.ts`; HSTS confirmed auto-set by Vercel |
| M5 | MEDIUM | Mass assignment in admin product routes | ✅ Closed — explicit field allowlist with stripped-field logging |
| M6 | MEDIUM | Internal errors leaked to clients | ✅ Closed — 140 `err.message` leaks replaced across 24 files via one-time sweep script |
| L1 | LOW | Google OAuth missing issuer check | ✅ Closed — `iss` validation added |
| L2 | LOW | Geolocation lookup over HTTP | ✅ Closed — switched from ip-api.com (HTTP) to ipapi.co (HTTPS) |
| L3 | LOW | Magic link verify has no rate limiter | ✅ Closed — `authRateLimit` middleware applied |

---

## How to read this report

Every finding answers four questions:

1. **What was wrong** — in plain language, no jargon.
2. **What a cybercriminal could actually do** — a concrete attack scenario.
3. **How bad it was** — exploitable today, or needed another condition first.
4. **What shipped** — the actual fix deployed to production.

Severity reflects how bad the worst case is *and* how easy it would be to pull off.

---

## HIGH severity

### H1 — Stored XSS in journal articles ✅

**Where:** `frontend/app/journal/[slug]/page.tsx`

**What was wrong:**
The journal article body came from the database and was rendered using `dangerouslySetInnerHTML` with no sanitization. The browser would treat anything inside that body — including `<script>` tags and JavaScript event handlers — as real, executable code.

**What a cybercriminal could have done:**
This is a "stored XSS" attack. It needed an attacker to first have admin access (stolen password, phished session, leaked token, compromised admin device). Once they had it:

1. Log into the admin panel.
2. Create or edit any journal article, pasting malicious JavaScript into the body.
3. Publish it. Now every single visitor who reads that article runs the attacker's code, *and the browser thinks it's legitimate silkilinen.com code because it's hosted on silkilinen.com*.

With that code running on every visitor's browser, the attacker could:

- **Steal customer session cookies** — log in as any logged-in customer who reads the article.
- **Read everything on the page** — saved addresses, order history, account details.
- **Replace the checkout page** silently with a fake one that captures card details.
- **Trick users into re-entering passwords** with a fake "session expired" popup.
- **Inject hidden iframes** that mine cryptocurrency on visitors' devices.
- **Redirect to phishing sites** that copy silkilinen.com's design and harvest credentials.

There would have been no popup, no certificate warning, no clue anything was wrong. The malicious code ran from silkilinen.com, so browsers trusted it completely.

**How bad it was:**
Not exploitable without admin access first. Combined with M2 (admin token in response body), the chain could have led to single-shot permanent admin compromise from one poisoned article. This is why H1 was prioritized #2.

**What shipped:**
Installed `isomorphic-dompurify` and wrapped `article.body` through `DOMPurify.sanitize()` before passing to `dangerouslySetInnerHTML`. Production testing confirmed Tiptap (the admin's rich-text editor) also escapes raw HTML at input time, so the fix sits behind an existing defense — defense in depth.

---

### H2 — Google OAuth audience check fail-open ✅

**Where:** `backend/routes/customers.js` (Google auth handler)

**What was wrong:**
When a customer signed in with Google, the server checked that the Google ID token was issued for *this* app, not someone else's. The check looked like:

```
if (clientId && payload.aud !== clientId) { reject }
```

If `clientId` was empty (because the `GOOGLE_CLIENT_ID` environment variable wasn't set), the whole condition was false and the check was skipped. Any valid Google ID token from any Google-OAuth app on the internet would have been accepted.

**What a cybercriminal could have done (if the env var were missing):**

1. Attacker has any side-project that uses Google sign-in.
2. A target customer signs into the attacker's app with Google, giving the attacker a valid Google ID token for that customer's email.
3. The attacker sends that token to silkilinen.com's `/google` endpoint.
4. silkilinen.com asks Google "is this a real token?" — yes. Then *should* ask "is it for my app?" — but doesn't, because `clientId` is undefined.
5. silkilinen.com signs the attacker in as the customer. Full account access — order history, saved addresses, ability to place orders.

**How bad it was:**
`GOOGLE_CLIENT_ID` was confirmed set in Railway production (verified visually in the Railway dashboard during the fix session). So this attack was **not currently possible**. The bug was in the *code*, not the config — if the env var was ever removed, renamed, or missed during a redeploy, the site would silently go back to wide-open.

**What shipped:**
Fail-closed code: if `GOOGLE_CLIENT_ID` is missing, all Google sign-in requests are refused (HTTP 503) instead of accepted. Two-line change, instantly hardens against future config mistakes.

---

### H3 — HTML injection in Drop a Hint emails ✅

**Where:** `backend/services/email.js`

**What was wrong:**
The "Drop a Hint" feature lets a customer send an email to someone suggesting they buy a product. The customer-typed `message`, `recipientName`, `senderName`, and `productName` were pasted directly into an HTML email template with no escaping.

**What a cybercriminal could have done:**

1. Attacker uses the Drop a Hint feature like a normal user. In the "message" field, pastes HTML — for example, a fake-looking link that says "Click here to claim your £200 SILKILINEN voucher" pointing to a phishing site.
2. The email goes out via Resend, from a real silkilinen.com sender address, with real silkilinen.com branding around the malicious content.
3. The recipient sees what looks like an official silkilinen.com promotional email and clicks the link.
4. They land on a fake silkilinen.com that captures their email and password, or asks for card details to "verify" the voucher.

The attacker could also have injected tracking pixels (silently learn which recipients opened the email), redirect images leading to malware downloads, or fake order confirmations to scare people into clicking.

The brand abuse dimension is what made this dangerous — the phishing email arrives from a real silkilinen.com address, passes SPF/DKIM, and looks legitimate. The brand reputation damage would have been on silkilinen.com, not the attacker.

`<script>` tags don't execute in email clients, so this wasn't full XSS — but everything *visual* was fair game, more than enough for phishing.

**How bad it was:**
Live and exploitable by anyone who could trigger the Drop a Hint flow.

**What shipped:**
Added an `esc()` helper that HTML-escapes the five dangerous characters (`& < > " '`) and applied it to every user-supplied string. Also added URL validation for `productUrl` and `productImage` — only `http://` and `https://` URLs are allowed, blocking `javascript:` and `data:` URL attacks. The subject line was also escaped.

---

## MEDIUM severity

### M1 — JWT verify missing explicit algorithm ✅

**Where:** `backend/middleware/auth.js`

**What was wrong:**
When the backend verified an admin JWT token, it didn't explicitly say which signing algorithm it expected. Older versions of the JWT library (`jsonwebtoken` < 9.0.0) would accept *any* algorithm the token claimed to use, including the "none" algorithm — which means "trust me, no signature needed."

**What a cybercriminal could have done (on old library versions):**

1. Attacker crafts a fake admin JWT that says `alg: "none"` in its header. No secret needed.
2. Sends it to the backend.
3. On vulnerable library versions, the backend says "oh, no signature needed? Cool, you're admin."
4. Full admin panel access, instantly.

**How bad it was:**
`jsonwebtoken@9.0.3` was confirmed installed, which rejects `alg: "none"` and defaults to HS256 — so this attack was already blocked by library defaults. The fix was hardening against future regressions (e.g., someone refactoring the JWT setup and inadvertently re-enabling old behavior).

**What shipped:**
Added `{ algorithms: ['HS256'] }` to the `jwt.verify()` call. One-line defense in depth.

---

### M2 — Admin JWT in response body ✅ (reclassified)

**Where:** `backend/routes/auth.js` (admin login) + `frontend/app/api/admin-session/route.ts`

**What the audit thought was wrong:**
"`res.json({ success: true, token })` returns the JWT in the body, requiring the frontend to store it somewhere. If stored in localStorage, any XSS (including H1 above) can exfiltrate admin credentials and take over the admin panel."

**What the actual architecture turned out to be:**

The audit graded this assuming the worst case. Reading the full flow:

1. The backend sets the token as an HttpOnly cookie on the **Railway domain** for API calls
2. The login response *also* includes the token in the body (commented in code as a "cross-domain cookie workaround")
3. The frontend immediately POSTs that token to `/api/admin-session` (a Next.js API route on the **Vercel domain**)
4. That route sets the token as an HttpOnly cookie on the Vercel domain (so Next.js middleware can see it)
5. The proxy reads the Vercel-domain cookie

So the token transits through browser JavaScript for ~50 milliseconds during login (in the `data.token` variable), but it's never stored in localStorage, sessionStorage, or any JS-readable cookie. It's not the permanent-XSS-target the audit feared.

**What a cybercriminal could have done:**
The narrow window of JS exposure on the admin login page was theoretically exploitable, but only if XSS already existed on the login page itself (it doesn't — no `dangerouslySetInnerHTML`, no user content rendering).

A real weakness *was* spotted in `/api/admin-session POST`: it accepted any string sent in the request body and set it as the Vercel-domain HttpOnly cookie, with no verification. Not exploitable for unauthorized access (the backend still rejected forged tokens at API calls), but it allowed bogus cookies to persist.

**What shipped:**
Added a verification step in `/api/admin-session POST` — before setting the cookie, the route now calls Railway's `/api/auth/me` to confirm the token is valid. The cookie is only set if Railway accepts it. Adds ~100ms to login, eliminates the bogus-cookie vector.

**What's still ideal (future work, not blocking):**
The truly bulletproof fix would be to proxy the entire login through a Vercel API route so the token never touches browser JavaScript at all. Bigger architectural change, kept out of scope.

---

### M3 — Admin proxy only checks cookie presence ✅

**Where:** `frontend/proxy.ts`

**What was wrong:**
The Next.js proxy (formerly `middleware.ts`, renamed to `proxy.ts` for Next.js 16) guarding `/admin/*` URLs checked "does the user have a cookie called `token`?" — not "is that cookie a valid signed JWT?" Any random value in a cookie named `token` was treated as logged-in.

**What a cybercriminal could have done:**

1. Use browser developer tools to set a cookie called `token` with value `hello`.
2. Navigate to `/admin`.
3. The admin panel UI loads.

This didn't give the attacker any real admin power — the backend API still verified the JWT properly, so any API call the panel made would fail. But it exposed the structure of the admin panel (which routes exist, what features are there), revealed API endpoint names by inspecting the network tab, and helped attackers map targets for other attacks.

**How bad it was:**
Low-impact on its own (data was safe), but a reconnaissance gift and a sign the auth model wasn't quite right.

**What shipped:**
Added a JWT format regex (`/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/`) to the proxy. The cookie must look like a real three-segment JWT to pass. This blocks trivial DevTools bypasses while leaving the real authentication to the backend.

**What's still ideal (future work):**
Full JWT signature verification using `jose` (Edge Runtime compatible). Requires `JWT_SECRET` to be available as a Vercel environment variable. Marginal improvement (backend already verifies signatures), deferred.

---

### M4 — Missing HTTP security headers ✅

**Where:** `frontend/next.config.ts`

**What was wrong:**
The frontend sent no security headers. Modern browsers have built-in defenses against several classes of attack, but only if the server tells them to use those defenses via response headers. None of the standard ones were set.

**What a cybercriminal could have done (per missing header):**

- **No `X-Frame-Options`:** An attacker could put silkilinen.com inside an `<iframe>` on their own site, then trick the user into clicking what looks like a harmless button but was actually a "delete my account" button underneath. This is clickjacking.
- **No `X-Content-Type-Options`:** If someone uploaded a file that looked like an image but contained JavaScript, the browser might have "sniffed" and executed it as JavaScript anyway.
- **No `Referrer-Policy`:** When a customer clicked a link from silkilinen.com to anywhere external (Cloudinary, Stripe, a partner), the destination site would see the full URL they came from — possibly including order IDs, search terms, or account paths.

**How bad it was:**
Defense-in-depth. None of these were active exploits — they were missing safety nets that would catch attacks slipping past other defenses.

**What shipped:**
Added four headers via Next.js `headers()` config:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

`Strict-Transport-Security` was confirmed set automatically by Vercel (`max-age=63072000`, two years). No need to add it manually.

CSP (Content-Security-Policy) was deliberately deferred — it requires careful inline-style handling and is best done as a focused work session.

---

### M5 — Mass assignment in admin product routes ✅

**Where:** `backend/routes/adminProducts.js`

**What was wrong:**
When an admin created or updated a product, the code took the entire request body and wrote it straight into the database, without filtering which fields were allowed. The POST used `Product.create({ ...req.body, ... })`, the PUT used `Object.assign(product, rest, ...)` where `rest` was the whole body minus images.

**What a cybercriminal could have done (admin or admin-compromise required):**

If an attacker had admin access, they could send a product update request including fields that shouldn't be settable — internal flags, hidden metadata, or fields not yet invented but added to the schema in future.

The actual risk depended on which fields the Product model had. Today, nothing critical. But every time a new field is added to the schema in future (e.g., `featured`, `costPrice`, `internalNotes`, `discountCode`), it would silently become settable from the outside without anyone noticing.

**How bad it was:**
Low impact today, but a "future footgun" that grows every time the schema is extended.

**What shipped:**
Added a `PRODUCT_ALLOWED_FIELDS` allowlist constant and a `pickProductFields()` helper. Only the 17 explicitly-listed fields can be set via the API. Anything else is silently stripped (with a `console.warn` to the server log naming the stripped fields, so future schema additions are easy to spot during testing).

---

### M6 — Internal errors leaked to clients ✅

**Where:** ~140 catch blocks across 24 route files

**What was wrong:**
When something went wrong server-side, the raw error message was sent back to the client in the response body. Error messages from MongoDB, Stripe, and Node.js often contained internal details — schema field names, validation rules, file paths, missing configuration variable names.

**What a cybercriminal could have done:**
Reconnaissance, not direct exploitation. The attacker pokes the API with invalid input on purpose, watches the errors, and learns:

- **Schema structure:** "Validation failed: `customer.passwordHash` is required" tells the attacker that field name exists.
- **Missing config:** `"GEMINI_API_KEY is not set"` tells the attacker which env vars to target if they ever get a foothold on Railway.
- **File paths:** Stack traces in 500 errors reveal directory structure, file names, sometimes line numbers — a map of the codebase.

None of this directly compromised the site. It made every other attack easier and more targeted.

**What shipped:**
Wrote a small one-time Node.js script (`scripts/fix-err-message-leaks.js`) that swept all routes, middleware, and services, replacing `res.status(500).json({ error: err.message })` with `console.error(err); res.status(500).json({ error: 'Internal server error' });`. The script applied 140 replacements across 24 files in one pass. 4xx responses (validation errors with intentional user-facing messages) were left alone. Stragglers in 13 single-line catch handlers in `adminSocial.js` and `social.js` were mopped up with a VS Code regex find-and-replace.

Full errors are still logged server-side (visible in Railway logs); only the client response is now generic.

---

## LOW severity

### L1 — Google OAuth missing issuer check ✅

**Where:** `backend/routes/customers.js` (Google auth handler)

**What was wrong:**
The Google sign-in verification didn't explicitly check that the token was issued by Google's actual servers (the `iss` field should be `accounts.google.com` or `https://accounts.google.com`).

**What a cybercriminal could have done:**
In practice, almost nothing — silkilinen.com asks `tokeninfo.googleapis.com` to validate the token, and Google's own server only validates tokens it issued. For this to be exploitable, Google's infrastructure would have to be compromised, which isn't a realistic threat model.

**What shipped:**
Added explicit `iss` validation immediately after the audience check. Defense in depth, three lines of code.

---

### L2 — Geolocation lookup over HTTP ✅

**Where:** `backend/routes/track.js`

**What was wrong:**
Visitor analytics enriched IP addresses with country/city info by calling `http://ip-api.com` — plain HTTP, not HTTPS.

**What a cybercriminal could have done:**
A network attacker between Railway and ip-api.com could have intercepted the request and returned false location data. This corrupts the analytics dashboard but doesn't compromise any customer data — no credentials are sent in the request. Analytics integrity issue, not a security breach.

**What shipped:**
Switched from `ip-api.com` (free tier HTTP-only) to `ipapi.co` (HTTPS-native, 1000 requests/day on the anonymous free tier — comfortably above expected traffic given the 24-hour geo cache). Field names were remapped (`country_name` → `country`, `country_code` → `countryCode`) so the rest of the analytics code didn't need to change.

---

### L3 — Magic link verify has no rate limiter ✅

**Where:** `backend/routes/customers.js` (POST /verify-magic-link)

**What was wrong:**
The endpoint that verifies magic-link tokens had no rate limiter applied.

**What a cybercriminal could have done:**
In theory, brute-force the token. In practice — tokens are 256-bit random values. To brute-force a 256-bit space, an attacker would need to send more requests than there are atoms in the observable universe before finding a valid token. Tokens are also single-use and expire after 15 minutes.

**How bad it was:**
Functionally zero. Worth fixing only because "always rate-limit auth endpoints" is good hygiene.

**What shipped:**
Applied the existing `authRateLimit` middleware (already used by `/request-magic-link` and `/google`) to `/verify-magic-link`. One-word change.

---

## Incidental improvements made during the audit

These weren't audit findings but were cleaned up as part of the work:

- **`middleware.ts` → `proxy.ts`** — Renamed to match Next.js 16's new convention. The deprecation warning in the build output prompted the rename.
- **Stripped-field logging in `adminProducts.js`** — The M5 allowlist helper logs any stripped fields so future schema additions are easy to spot.
- **One-time sweep tooling** — The M6 fix produced a small Node.js script (`backend/scripts/fix-err-message-leaks.js`) that can be re-run if the pattern ever reappears.

## Adventures along the way

A `npm audit fix --force` ran in the frontend during the H1 setup, which yo-yo'd Next.js between 16.2.6 and 9.3.3, breaking package-lock.json. Recovered cleanly via `git checkout package.json package-lock.json` (the changes hadn't been committed) followed by `rm -rf node_modules && npm install`.

**Lesson:** `npm audit fix --force` is almost never the right answer. The safe path for genuine vulnerabilities is to upgrade specific packages by hand in a planned session, reading the upgrade guides for any major-version bumps.

---

## What was confirmed during the fix session

- ✅ `GOOGLE_CLIENT_ID` is set in Railway production (verified visually)
- ✅ `jsonwebtoken@9.0.3` installed (above the vulnerable < 9.0.0 threshold)
- ✅ Admin token stored in HttpOnly cookies on both Railway and Vercel domains (not localStorage)
- ✅ Vercel auto-sets `Strict-Transport-Security: max-age=63072000` on the custom domain
- ✅ All four added security headers visible in production response headers via `curl.exe -I https://www.silkilinen.com`

---

## Follow-up audit areas (not part of this scope)

These were flagged earlier as worth verifying in a follow-up pass but weren't part of the 12 findings:

1. **Stripe webhook handling** — Confirm raw-body parser is mounted before json parser on the webhook route, and `stripe.webhooks.constructEvent` is used (not manual JSON.parse).
2. **Order amount recomputation** — Verify the total charged to Stripe is computed server-side from product IDs, not trusted from the client.
3. **`/request-magic-link` enumeration response** — Verify the response is identical for known vs unknown emails.
4. **Backend CORS config** — Verify it's an explicit allowlist, not `origin: true` or reflective.
5. **`npm audit` results** — Backend wasn't audited; frontend has 88 issues, mostly in Next.js's dev/build chain. Plan a dedicated Next.js upgrade session (NOT via `npm audit fix --force`).
6. **Git history for secrets** — `git log --all --full-history -- .env .env.local` to confirm no env files were ever committed.
7. **`unsubscribeToken` generation** — Verify it uses `crypto.randomBytes()` not a short/sequential value.
8. **Other HTML email templates** — The same "user input into HTML email" pattern exists in `sendWelcome`, `buildHtml` (order confirmation), and `buildStatusHtml`. Lower risk because these emails go to the customer themselves, but the pattern could be tightened with the same `esc()` helper.
9. **Mass assignment on User/Customer models** — M5 only covered Products. The same pattern check should be run on customer-facing update endpoints, where the dangerous fields (`isAdmin`, `role`) actually live.
10. **Proper M2 fix** — Server-side login proxy through Vercel so the JWT never touches browser JavaScript at all.
11. **Full M3 fix** — JWT signature verification (not just format check) in the proxy, using `jose`.

---

## Notes for keeping things tight going forward

- Every time a new endpoint is added, the patterns in M5 (mass assignment) and M6 (raw error leakage) will reappear unless guarded against by default. Consider a middleware or schema-validation wrapper that handles both centrally.
- If user-generated rich content is ever added (comments, reviews, customer profiles with bio), H1's pattern needs to be checked again — DOMPurify is required everywhere `dangerouslySetInnerHTML` appears in the frontend.
- The frontend has 88 npm-audit vulnerabilities, mostly in Next.js's build toolchain. These aren't runtime-exploitable, but should be cleared in a planned Next.js upgrade session.
- The `console.warn` in `pickProductFields()` will catch any schema fields you add and forget to allowlist. Worth checking Railway logs occasionally after schema changes.
