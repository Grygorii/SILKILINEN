# Customer lifecycle and backend/frontend consistency

Base: b0bbfb9b8cf7a450d0f8aee0b5f03e43d443bbc0.

## Scope
- Reconcile historical and future guest purchases into CRM profiles and explicit order links. A CRM profile is not a login, verified email, or marketing opt-in. Existing identities and consent are preserved. Missing-email and conflicting-link records are flagged, never guessed.
- Use one integer-cent, EUR-canonical order-statistics service for customer counts, net spend, purchase dates and sales reporting. Fulfilled orders remain purchases; cancelled/failed attempts do not inflate sales. Refunds reduce net spend.
- Durable order synchronization markers and a bounded, idempotent transaction-based worker run after database connection and every minute. Order status/refund/manual changes mark records for retry. Payment processing does not depend on a successful CRM write. Manual customer synchronization uses the same service.
- Restrict admin customer responses to explicit fields; restrict buyer order and wishlist responses to public fields. Old sessions cannot open erased accounts. Erasure remains transactional and retained financial orders cannot silently recreate an erased contact.
- Consume magic links atomically; optional welcome-mail failures do not defeat a successful login. Validate Google ID tokens using the official library and verify account ownership when linking an existing contact.
- Repair CSV and personal-data export HTTP methods, stale search responses, pagination, profile-edit error handling and logout CSRF integration. Label guest contacts and surface unresolved synchronization records in the admin tab.
- Preserve order-status transitions and prevent same-status email/history duplicates. Failed Stripe order persistence returns a retryable response instead of a false success. Related-product lookups accept canonical slugs.
- Reject over-refunds and unsafe EUR-to-foreign-charge refunds. Foreign-currency refunds still require the Stripe dashboard; this release does not implement currency conversion or a complete refund-event reconciliation system.

## Data behavior and release safety
Deployment intentionally creates missing guest CRM profiles, fills order links and rebuilds derived customer statistics. It does not change order totals, line items, payment amounts, prices or stock. It does not send customer emails or change existing marketing consent. The worker is bounded to 50 orders per automatic run and retries failures; the standalone script defaults to dry-run and requires --apply for writes.

The additional fields are backwards-compatible. A code rollback does not reverse the profile/link repair and should not delete newly restored business records. Before release, record the currently active Vercel and Railway deployment IDs. Baseline Vercel: dpl_FJQZff2ZVgqK6XceXS2mWwtuBRWk. Baseline Railway API: 327358ec-6477-405c-ac31-7b9e70bdd2d5. Re-verify these references if later deployments exist.

## Verification
The isolated test suite exercises real Express routes and a temporary MongoDB replica set for transactions, concurrency, guest reconstruction, consent preservation, authorization, response projections, exports, invalid input, erasure, net-spend math, status updates, related-product slugs and webhook acknowledgements. Stripe, Google token verification and email providers are mocked; no live payments or customer emails are sent. Browser verification uses the actual React customer pages and Express/Mongo flow with synthetic data and an isolated admin session; only site navigation/layout are simplified for the test harness.

Known limits: this is not an audit of every backend route. Refund-event synchronization, cross-currency refunds, full cart-recovery behavior, broader financial reporting, and production Google/Stripe end-to-end transactions require separate verification. Missing buyer identity cannot be recovered without authoritative source data.
