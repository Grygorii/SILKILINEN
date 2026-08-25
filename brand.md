# SILKILINEN — Brand

This file is **facts only**. Strategic positioning is in `brand-open-questions.md`. Do not write copy that assumes a positioning direction that hasn't been decided.

## Identity
- **Brand:** SILKILINEN — silk and linen
- **Owners:** Гріша and Sabreena (sole trader, below Irish VAT threshold)
- **Base:** Donegal, Ireland — SILKILINEN is an **Irish brand based in Donegal**.
- **Product origin:** MIXED and per-product. Some pieces are made by hand in Donegal; others are sourced/manufactured abroad (e.g. China, India, Egypt). See ADR 0008.
- **Live site:** https://silkilinen.com

## Origin claims rule (regulated — get this right)
Origin is a regulated consumer claim. Treat every "made in" line as a fact to verify, never copy to polish.
- **Brand-level copy** (banner, footer, story, emails, SEO) must be true for the ENTIRE range: *"An Irish silk & linen brand, based in Donegal."* Never imply the range is Irish-made or hand-made-in-Donegal.
- **Per-product origin** lives in the `Product.origin` field and states where THAT piece is actually made ("Made by hand in Donegal" / "Made in India"). Empty = unverified; show nothing.
- **The ban is on MANUFACTURE, not on the place.** "Ireland" and "Donegal" are not
  words to avoid — they describe things that are simply true and are meant to be USED.
  The line runs between DESIGN and MAKING, and it is one word wide: "designed in
  Donegal" is true; "designed *and crafted* in Donegal" is a manufacture claim.
- **Allowed because true — use these:** "Founded in Ireland" / "An Irish-founded brand";
  "based in Donegal"; "born in Donegal"; **"Designed in Ireland" / "Designed in Donegal"**
  (Sabreena designs here — true even when a piece is made abroad); "European design";
  "Inspired by …" where the collection genuinely is; "we ship from Donegal".
- **Enforced in code:** `backend/utils/originClaims.js` + `backend/tests/originClaims.test.js` (CI). This section is the intent; that file is the rule — its ALLOWED list is the positive half and is pinned by test. Live-DB copy is NOT covered by CI — run `scripts/auditCopyClaims.js`.
- **Banned as blanket claims:** "Handmade in Ireland", "Made in Donegal" (on everything), "crafted/cut/sewn by hand in Donegal", "Irish silk/linen" (of the product), "we produce / our production", "small batches" — and do NOT swap one blanket false claim for a softer one.
- **Changed 2026-08-25:** "designed in Donegal" was previously listed here as banned-because-unverified. The founders confirmed Sabreena designs the pieces in Ireland, so it moves to allowed. The verified fact changed, not the rule.

(Supersedes the old "Donegal in depth, Ireland on the surface" layering rule — ADR 0005, now reversed by ADR 0008.)

## Voice (what's actually committed)
- No exclamation points except in error states
- "Silk" and "linen" lower-cased in prose; "SILKILINEN" all-caps when referring to the brand
- Trust language: "14-day hassle-free returns" (footer), "Secure checkout · Stripe" (cart)
- Free shipping line: "free shipping over €150 to Ireland" — Ireland specifically, not "worldwide"

## CSS variables (actual, from globals.css)
- `--dark` = `#2a2218` (charcoal, primary text + button fill)
- `--border` = `#e8e2d6` (light border)
- `--cream` (background warmth on cards, empty states)
- `--warm-white` (page background)

Confirm exact values for `--cream` and `--warm-white` before quoting them anywhere. Don't invent hex codes.

## Typography
- Headings: Cormorant Garamond (serif, editorial)
- Body / UI: Jost (sans, uppercase + tracking on labels)
- Numerics in price displays: `font-variant-numeric: tabular-nums` so prices align across rows

## Live promo codes
- `SILK10` — 10% off, single use per customer, no expiry, source: `newsletter_welcome`. Advertised in: AnnouncementBar, account page, NewsletterBand, welcome email, seedSiteContent.

## What's intentionally NOT in this file
- Persona work (Maeve / luxury slip-dress buyer) — not validated against real sales data
- "Wearable memoir" or similar emotional positioning — not committed
- Pricing tier strategy (€60–90 / €120–180 / €200–300) — specified without Etsy data
- Donegal motif visual program — beautiful long-term vision, paused

If a chat is drifting toward any of the above, stop and re-read `brand-open-questions.md`.
