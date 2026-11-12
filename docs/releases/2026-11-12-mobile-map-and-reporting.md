# Mobile map and revenue reporting release

Base: 1aaeaaf6bb8a4b9d2bedf1c7399624219e9b14d5 (the other chat's live map and webpack build fix). Preserve those build, care-guide, global-style and homepage-placement changes.

## Changes
- Replace the same ShippingMap component, not add a second map. Historical destinations and available delivery countries have separate controls and wording. Historical travel is illustrative, never courier GPS or invented orders. The 11 initial countries were explicitly confirmed by the founder. Additional website country presence comes from orders marked shipped/delivered; no order counts, IDs, timestamps or customer addresses are exposed.
- Delivery countries come from the exact same 38-country constant used by checkout. This release does not enable new delivery destinations. Etsy history beyond the founder's list still requires a verified import, not fabricated activity.
- Mobile-first country selector and map framing; 44px minimum controls, pause/play, reduced motion and offscreen/background pause. Local simplified Natural Earth land geometry (public domain); no map SDK or tracking provider.
- Fix attribution storage mismatch; add a separate browserSessionId to reporting metadata without changing the cart selector or price arithmetic. Optional Visit lookup is bounded and fail-soft so a reporting failure cannot prevent saving a paid order.
- Support non-redirect Stripe success with a short-lived tab-local credential handoff. New confirmation requests use POST, carry the existing CSRF header, and return no-store responses; older GET clients remain compatible during rollout. Charges and refund logic are not changed.
- Preserve actual purchase currency, journal visit coverage, product-card IDs, and sendBeacon fallback. Existing first-party consent policy and persistent browser/session semantics still need a separate privacy/measurement review.
- Exclude seeded reviews from public lists, ratings and helpful voting without deleting database rows. Label Etsy provenance separately from website purchase verification.
- Connect the existing Champagne, Copper and Sky Blue boxer products with canonical colour links when no admin-authored links exist. This is a reversible code fallback, not a product or stock migration.
- Add a catalogue-driven shopping edit to the existing silk-packing journal article, showing only active, in-stock products.

## Verification and limits
Run both existing test suites, TypeScript, invariant lint and the webpack production build. Added HTTP tests use mocked Stripe and database queries; no real card is charged. Browser checks cover map controls at 320/375/390/430/768/1440px and reduced motion, plus both redirect and non-redirect confirmation flows, currency, attribution, reload deduplication and absence of credentials in purchase events. These mocked-flow checks are not a real Stripe test-mode transaction or an iOS Safari certification.

Pre-release rollback references: Vercel dpl_FuNwwBtvHKZQkYDacTuyd9S9CD9J; Railway API 00efa282-6326-489d-a171-c2fced690312. Roll back both services if required; a frontend rollback alone does not reverse backend changes. No database migrations, customer-data deletion, product price changes, or infrastructure permission changes are included.
