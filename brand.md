# SILKILINEN — Brand

This file is **facts only**. Strategic positioning is in `brand-open-questions.md`. Do not write copy that assumes a positioning direction that hasn't been decided.

## Identity
- **Brand:** SILKILINEN — silk and linen
- **Owners:** Гріша and Sabreena (sole trader, below Irish VAT threshold)
- **Origin:** Donegal, Ireland
- **Live site:** https://silkilinen.com

## Copy layering rule (intentional — do not "fix")
- **Announcement bar:** says "Ireland" — broad, internationally recognizable surface
- **Product pages, transactional emails, story copy, AI image prompts, footer:** say "Donegal" — specific, authentic origin

These are deliberately different. Surface = welcoming; depth = specific. Don't unify them.

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
