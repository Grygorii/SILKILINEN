# Evidence-led reporting and Growth Engine repair

Baseline: 16f20f8dd7d663fca5112d1e36375f1c89c4eaaa. No checkout arithmetic, order values, prices, stock, customer identities, delivery coverage, or public URLs are changed by this code release.

## What is repaired
- Search Console periods contain exactly the requested inclusive Pacific calendar dates, with non-overlapping comparisons and finalised web-search data. CTR changes use percentage points; average position is not equated with a particular results page. Shopping and editorial page review cues expose impressions, clicks, CTR and average position without promising demand or sales.
- Paid order records are the source of truth, independent of browser purchase events. Exact browser links explain attributable sales; historical default Direct without a link remains Unknown. Source rates stay unavailable when website orders are unlinked. Manual/offline orders are separate. Browser IDs are not timed sessions or verified people.
- Product-page visits count as product reach even when view_item is missing. Transitions intersect the same browser IDs in time order. Missing steps are not fabricated or clamped. Major coverage gaps suppress causal abandonment diagnoses. Geography alone is not used to discard traffic as bots.
- A read-only Growth Evidence panel exposes current purchases, coverage, strategy freshness, unresolved drafts and three practical priorities with measurements. June's 90-day strategy is retained as historical rather than presented as a current plan.
- Manual, scheduled and inter-agent runs share owner-checked leases. Failed/degraded agent attempts do not become successful runs, and retry backoff is separate from normal cadence. Identical unresolved action cards are deduplicated; underlying specialist-created draft entities still require separate review. A strategy no longer secretly starts a forced full-agent pulse. Provider calls have a bounded timeout and no automatic request retry.
- Brief/strategy prompts receive current commerce evidence and treat low prices, small samples, missing sources, and prior playbook notes cautiously. Unavailable core data retains previous briefs rather than generating a false-zero narrative. Generated learnings and auditor findings require review instead of being inserted as verified shared knowledge; automatic archivarius.tick at the end of a pulse is removed. The weekly slot advances only after an actual saved brief.
- Acquisition capture handles blocked storage safely, recognises common organic/social sources, excludes self-referrals and stores only the external origin rather than referrer query strings.

## Production observations and scoped metadata edits
On 12 November, the 30-day order ledger contained two purchases totalling EUR 268.09 and three boxer units. Both predate the new attribution repairs and lack browserSessionId; default direct is not source evidence. Only the November 7 order is in the current 14-day window. Historical sources were not guessed or rewritten.

Three compare-and-set metadata corrections were made in Atlas, separately from code:
1. categories/lingerie metaTitle: `Mulberry Silk Lingerie, Naturally Hypoallergenic — SILKILINEN` → `Mulberry Silk Lingerie & Bikini Briefs`.
2. categories/robes metaTitle: `Mulberry Silk Robes | Pure Silk, Handcrafted in Ireland — SILKILINEN` → `Mulberry Silk Robes | Pure Silk Robes`.
3. products/silk-boxer-short-bare-in-champagne metaDescription: `A pure silk satin boxer short in bare champagne, hand-finished in Donegal. Relaxed cut in 19 momme mulberry silk with a structured black waistband.` → `Pure 19 momme mulberry silk satin boxer shorts in bare champagne. Relaxed cut with a structured black waistband. Explore sizes and delivery details.`
These remove duplicated branding and unsupported origin/health claims. No metadata bulk rewrite, price edit, product migration, customer message or advertising purchase was performed. The current catalogue composition supports the Champagne product's 19 momme statement. Reverting code does not revert these three fields; restore individual previous values only when justified, not unsupported origin claims.

## Validation and boundaries
Tests exercise pure calculations and real Express/MongoDB replica-set routes, concurrency leases, honest failures, private access, and provider-mocked brief/strategy generation. A mocked Stripe checkout→webhook→order→report test verifies a new exact browser link without a success-page event or duplicate order on retry. Browser checks use the actual reporting components and real local API/database with synthetic records; Google responses and external providers are fixtures. No production admin session is impersonated and no real payment, refund, email or forced AI publishing run is used as a test.

Known limitations: historical missing attribution cannot be reconstructed. Browser identifiers remain persistent; not all automated traffic is identifiable. Client tracking and consent/session semantics still require a separate review. This is not a guarantee of accuracy for every legacy dashboard or every specialist-generated draft. Live Google OAuth/provider success and a subsequent real sale must be checked through the normal authorised workflow. No sales uplift is claimed.

## Recovery and rollback
A persistent, explicitly snapshotted workspace and staged patch back up this release. The initial interrupted attempt did not reach production. Roll back Vercel and Railway to the baseline commit if necessary; rolling back the frontend alone does not revert the reporting API or AI workflow changes. The three metadata edits are separate and recorded above.
