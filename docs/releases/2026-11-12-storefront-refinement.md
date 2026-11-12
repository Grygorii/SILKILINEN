# Storefront refinement — 12 November 2026

Base: 6c3f1d998f4551f119a5337b1f2a1b5406ef05c6. This release changes storefront presentation and map playback only. No backend, payment arithmetic, customer records, product URLs, prices, stock, delivery coverage or credentials are changed.

## Design and behavior
- Preserve the existing Cormorant Garamond, Jost and EB Garamond fonts, warm ivory/espresso palette and restrained two-pixel corners. No new font or mapping SDK.
- Move the same shipping map immediately after the homepage's first product selection. Do not put it ahead of products or add a second map.
- Replace the dark dashboard-style map with a compact ivory editorial section, understated routes, short copy and collapsed supporting detail. History and delivery availability remain separate: 11 founder-confirmed countries plus known website shipment destinations versus the existing 38 checkout destinations.
- Autoplay shipment journeys on entering the viewport. Country selection and switching back from delivery coverage do not permanently pause playback. The explicit pause control freezes/resumes the SVG timeline; keyboard focus holds country rotation; reduced motion is static; offscreen or background content pauses. Delivery availability remains a static illustrative route, not a fabricated shipment.
- Remove artificial product-photo sheen and badge shimmer. Retain useful image hover and wishlist feedback at a smaller scale. Show product photography immediately, with consistent mobile gutters and 44px carousel arrows.
- Refine hero and button type, spacing and touch sizes. Replace expanding hover lettering with a stable neutral color transition. Use a warm light mobile hero scrim behind dark text rather than darkening the background behind it.

## Verification scope
Front-end unit/regression tests, TypeScript, targeted lint, invariant checks and production webpack build. Browser checks cover phone/tablet/desktop widths, real map animation state, selection, explicit pause/resume, coverage/history separation, reduced motion, offscreen pause and homepage section ordering. Shopping checks stop at the priced checkout summary before payment creation; only the read-only quote endpoint is permitted. Analytics and other writes are blocked during browser verification.

A successful build is not evidence of improved sales. Compare subsequent real orders and customer journeys, and do not infer a conversion lift from this visual release alone. Physical iPhone/Safari certification and a real Stripe payment are not claimed.

## Rollback
Pre-release frontend deployment: dpl_9ggosv36Xt2NeBXnaSd9JHoQtyJv (verify no later release supersedes it). Roll back the frontend or revert this commit if required. There is no data migration to reverse, and the customer-lifecycle backend repair from the base commit remains intact.
