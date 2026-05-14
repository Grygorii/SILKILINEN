# SILKILINEN — Project State

Living document. Update this file every time a change is shipped to the SILKILINEN project.

Last updated: 14 May 2026 (evening).

---

## What it is

E-commerce platform for a silk and linen brand, live at https://silkilinen.com. Owned by Гріша and his wife Sabreena. Brand origin is **Donegal, Ireland** (not Dublin — all customer-facing copy updated 14 May 2026). Built over roughly 12 working days using AI-augmented development (Claude in the chat for design and planning, Claude Code in VS Code for implementation).

**Brand copy layering (intentional):** The main announcement bar says "Ireland" (broad, internationally recognizable, welcoming surface). Product pages, emails, story copy, AI prompts, and footer all say "Donegal" (specific, evocative, the authentic depth of origin). This is deliberate — not a contradiction.

The site exists primarily to **escape Etsy's fee burden** (Etsy takes ~15-20% effective on each sale) and capture margin on existing Etsy product sales. The actual current hero product per the founders is silk panties at volume, not the dress/robe products currently most visible on the site. Strategy work that assumed luxury slip-dress positioning needs a reality-check pass against Etsy sales data before being acted on.

## Confirmed stack

- **Frontend:** Next.js on Vercel, deployed to `silkilinen.com` and `www.silkilinen.com`
- **Backend:** Express on Railway at `silkilinen-production.up.railway.app`
- **Database:** MongoDB Atlas (Mongoose models)
- **Image hosting:** Cloudinary, cloud name `dzybw5t5z`
- **Payments:** Stripe (currently test mode — verify before launch)
- **Email:** Resend (welcome emails, magic-link sign-in, transactional)
- **Auth:** Magic-link via email + Google OAuth for customers, JWT for admin
- **AI image gen:** Gemini integration with 5 model identities (Aoife, Charlotte, Sofia, Maya, Yuki) using v2 prompts
- **AI text (SEO):** DeepSeek (`deepseek-chat`) via OpenAI SDK; abstraction layer at `backend/services/aiText.js`; Gemini text removed

## Operational hardening shipped

- Node 20+ pinned via `package.json` engines + `backend/.nvmrc`
- `backend/railway.toml` forces Nixpacks builder (workaround for Railway Railpack BuildKit bug — remove once Railway fixes it)
- `app.set('trust proxy', 1)` in Express so rate-limiter reads real client IP behind Railway's reverse proxy
- Rate limiter is 5xx-aware (`requestWasSuccessful + skipFailedRequests`) — won't lock customers out during infrastructure outages
- Resend health check uses configuration validation (not live API call), compatible with the send-only API key
- Visit tracking with 90-day TTL, order attribution (customer session → order)
- Auth error responses are clean user-facing messages (no raw Mongoose/Node error text leaking to clients); infrastructure failures return structured 503
- Signed-token preview URLs for draft products (1hr JWT, noindex page, `PREVIEW MODE` banner)
- Visit tracking excludes admin sessions (pathname guard in `track.ts`)
- Geolocation on each visit (ip-api.com, 24hr in-memory cache, country + city + region stored on Visit documents)

## Customer-facing features live

Browse / product detail pages, cart with quantity adjustment and stock caps, wishlist, magic-link or Google OAuth sign-in, Stripe checkout, customer accounts. Newsletter signup with welcome email + SILK10 code. "Just sold" social-proof popup (public endpoint, no auth required). Free-shipping-over-€150-to-Ireland banner.

## Admin tooling shipped

Mobile-first admin panel — sidebar on desktop, drawer + bottom-tabs on mobile. Seven sections: Dashboard, Products, Orders, Customers, Marketing, Content, Settings.

The Dashboard surfaces today/week/month revenue, top products, traffic sources, action items, a 30-day sparkline, with 5-minute auto-refresh. Zone 4 system-health monitors Mongo, Cloudinary, Resend, Stripe, and env vars on a 60-second poll.

Other admin pages:
- **AI Models page** — 5 identities (Aoife, Charlotte, Sofia, Maya, Yuki), unlocked, v2 prompts with separate `productShotPromptTemplate` and `lifestyleShotPromptTemplate` fields per model
- **Product CRUD** — "Add Product" creates an empty draft immediately and redirects straight to the full edit page (no intermediate form). Blocking validation modal on save (lists missing required fields by name, requires explicit "Got it" dismiss, scrolls to first invalid field after close); structured backend validation errors (save-level: name + price; publish-level: category, description ≥ 50 chars, images, variants)
- **Product duplicate** — clears SEO fields (`altTextTemplate`, `metaTitle`, `metaDescription`, `keywords`, `slug`) on duplicate so new product generates its own, no cross-contamination
- **Preview for drafts** — Preview button fetches a signed token, opens `/preview/[id]?token=...` in a new tab; page is noindex and shows a sticky "PREVIEW MODE — not yet published" banner
- **Photo slot picker** — named slots (HERO, FRONT, BACK, SIDE, DETAIL, LIFESTYLE) show a picker modal when clicked; admin can choose from existing unassigned uploads ("Use here") or upload new; filled slots show "↓ Gallery" (unslot without delete) + "Delete" actions
- **AI photo auto-routing** — approving a generated photo auto-places it into its matching named slot; if slot occupied, admin is prompted to replace or send to additional images
- **Dashboard geo** — "Top countries" and "Top cities" sections in WHAT'S WORKING zone; conversion math fixed (0% when no orders, — when no visitors, capped with warning log); conversion column hidden entirely until first order via `showConversion` flag; traffic sources, countries, and cities all show % of total sessions alongside conversion rates
- Order management

## Listed products as of 12 May 2026

- Aoife Terracotta Robe (first listed product) — AI-generated imagery, approved by Sabreena
- Existing Dalia / Bastet / Ciara / Rehab dress and robe products from earlier build phase
- **Silk panties** (the actual sales hero) — currently sold on Etsy, not yet migrated to silkilinen.com as primary

## Active scoped work, not yet built

- **THUMBNAIL slot auto-derive** — thumbnail generation still exists in AI workflow tiers but no named slot card shows for it; images with `slot: thumbnail` appear in Additional images. Future: auto-derive from HERO via Cloudinary transformation if needed.
- **Collections feature** including a "New Arrivals" toggle. Replaces a simple new-arrivals boolean with named collections products can belong to (Spring/Summer, Donegal Series, Editor's Picks, etc.).
- **Pricing spreadsheet** for the actual catalogue with cost-up + margin + Etsy fee comparison. Needs real Etsy sales data first.
- **Finance admin tab** ("captain's cabin") — daily revenue, monthly P&L, margin tracking, cash flow. Phase 2D.
- **GDPR cookie banner** with equal-prominence Accept/Reject. Required before any paid-ads tracking pixels.
- **Customer messaging system** — contact form + admin inbox + push notifications on new message.
- **PWA admin app** with push notifications for orders, low stock, system health, messages. Phase 2C.
- **VPS migration** — considered, not executed. Real architectural decision, deserves its own brief.

## Known bugs / minor

- Logo CSS: `letter-spacing` adds trailing space after the last glyph, visually shifting letter-spaced text left of center. Fixed 14 May 2026 — `align-items: center` on `.logoLink` + `padding-right` matching `letter-spacing` on each text span.
- Mongoose duplicate-index warnings on `Product.slug`, `Customer.email`, `Customer.googleId` — cosmetic in logs, not affecting functionality
- Microsoft Clarity tracker firing — origin unknown, investigate before enabling any paid-ads pixels
- `finalize()` in AiPhotoshoot (bulk-approve all photos at once) does not auto-route to slots — only individual `approvePhoto()` does. Bulk-finalized photos land in Additional images.
- Some env vars previously orphaned (`subject`, `to`, `body`, etc.) — clean-up done 8 May, worth a monthly env audit habit

## Where to start a new Claude chat about SILKILINEN

Paste this whole file at the top of the new chat, or just point to the `SILKILINEN.md` path in the repo root. Tell Claude:

> "I'm working on SILKILINEN. Current state is in this doc. Today I want to work on X."

That keeps every new conversation grounded in real state instead of stale assumptions.

---

## Strategy reality-check (read before acting on prior strategy docs)

The strategic documents from the previous Claude chat (Marketing Foundation, Donegal Motif Strategy, Pricing Strategy v1, Maeve persona work) were built on assumptions that don't match the current business reality. Specifically:

- The persona "Maeve" is a 32-year-old slow-fashion buyer with €200 budget for silk slip dresses. The actual current customer profile is unknown but the volume-buying-silk-panties-on-Etsy data suggests it's different.
- The Donegal motif strategy is a beautiful long-term vision but adds complexity. Founders paused it.
- Pricing tiers (accessible €60-90 / staple €120-180 / hero €200-300) were specified without seeing real Etsy sales numbers.

Before acting on any of those docs, pull real Etsy data: units per month, average price, top items, repeat rate, geographic distribution. Recalibrate from there.

The technical work and operational infrastructure stand on their own — those don't depend on the strategy being right. The site, admin, and tooling are usable for whatever business shape emerges from the data.
