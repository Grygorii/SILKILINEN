# Golden Rules — lessons from real incidents

Hard-won rules distilled from production incidents. The same set is recorded in
**Archivarius** (run `node backend/scripts/seedGoldenRules.js`, view in
Admin → Archivarius). Read these before touching create/edit flows, data gathers,
or error handling.

## The incidents that taught us

**1. Every weekly Chief brief was wrong — a missing import.**
`chiefOfStaff.measure()` called `Product.aggregate()` / `Product.countDocuments()`
but never imported `Product`. It threw `ReferenceError` at *call* time (not load
time), got swallowed by a fail-soft `.catch(() => SAFE_METRICS)`, and the Chief
saw **zero products / zero revenue** — writing a "pre-launch, no products" panic
even with 21 active products. That false-empty ground truth then made the Clerks
flag every real agent claim as a contradiction ("44 broken links").

**2. "Add product" silently did nothing.**
The blank-draft create did `new Product({ status:'draft' }).save()`, but `name`
and `price` are schema-`required`, so `.save()` threw a ValidationError → the
route 400'd → the page's `catch` **silently redirected back to the list**. It
looked like the button "started but never opened." The silent catch is why it
went unnoticed.

## The rules

1. **Audit the primary WRITE/user journeys first** (add product, checkout, edit,
   create) — not only background services and read paths. The highest-impact bugs
   live in the actions users take most.

2. **Fail loud, not silent.** Every fallback/catch on a user-facing action must
   produce a visible error or a logged trace. Never disguise a failure as
   "nothing happened."

3. **Data-layer integrity is its own defence.** Reasoning safeguards (auditors,
   clerks, memory) protect against bad reasoning over *good* data — they cannot
   catch a broken data gather. Guard the gather: verify before asserting
   empty/zero, and **skip** rather than emit a confident wrong result.

4. **`Model.method()` requires importing the model.** A missing import fails only
   at call time, slipping past load-time checks. When a service uses a model,
   confirm the `require` exists.

5. **Empty-draft creates still run Mongoose validators.** Required fields make
   `.save()` throw even when app-level validation is skipped. Use
   `save({ validateBeforeSave: false })` and re-validate on publish, or set safe
   defaults.

6. **Beware unique sparse indexes + derived values.** Deriving a slug from a
   placeholder name collides across drafts. Leave the unique field unset so the
   sparse index skips it; derive the real value on first edit.
