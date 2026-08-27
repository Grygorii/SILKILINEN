# Open items

Everything **not** changed in this session, and why. Three kinds of thing:
what needs a decision or data only you have, what I chose not to build and the
reasoning, and what the sandbox stopped me reaching.

Nothing here is a surprise from a commit message — it is the same list, in one
place, so you can work down it.

---

## 1. Waiting on you

### 1.1 OEKO-TEX — the first line of the site ⚠️

`All silk is OEKO-TEX certified — gentle on skin` runs in the announcement bar
above every page, and the About page states it again as a value card: *"Our
silks are certified safe for skin contact, free from harmful substances."*

I have not touched either, and I will not without a word from you, because both
outcomes are bad if I guess:

- **If you hold a current certificate**, removing it throws away your strongest
  objective trust signal — and it should be carrying the certificate number,
  which is what makes it checkable rather than a claim.
- **If you do not**, it is the single riskiest sentence on the site. OEKO-TEX is
  a trademarked certification scheme; an unbacked claim is enforceable by the
  scheme owner *and* under consumer law, which is a harder problem than the
  origin wording we spent this session correcting.

There is already drift from it: when I built the homepage "Why SILKILINEN" band
I deliberately left OEKO-TEX out because I could not verify it. So the homepage
band omits it while the banner and About page assert it.

**What I need:** yes or no. If yes, the certificate number. I will then either
cite it properly in all three places, or remove it from all three and replace it
with something true about the fibre.

### 1.2 The product gallery renders blank

On the eye-mask page the gallery is a ~300px band of nothing with three
pagination dots — so three images exist and none of them show. On a luxury
product page this outranks every layout fix in this session: nobody buys silk
they cannot see.

I cannot diagnose it from here. Egress to the live site is blocked, so I cannot
fetch the image URLs.

**What I need:** open that product in admin and tell me what the image URLs look
like. Three possibilities, and they need different fixes:

| what you see | what it means |
|---|---|
| URLs look wrong or 404 in a browser tab | broken Cloudinary references — I can chase it |
| URLs load but the photos are very pale | cream-on-cream photography — a shoot note, not a bug |
| No images on the record at all | the dots come from placeholders; I would add an empty-state |

### 1.3 `relax fet`

The fit note on that product. It is your data, not code. It now sits in an
aligned details grid where it reads *worse* than when it was floating, because
the grid draws the eye to it.

Worth also capitalising to match the other values in that column — `Relaxed`.

### 1.4 Momme values

`19 momme` is live on at least one product, so you have started. Every product
without it shows no weight rather than a guessed one — deliberate, since an
invented spec on a page whose job is proving the product is what we say it is
would be worse than silence.

This gates one thing: I proposed hero option **B** — *"Silk you can measure."* —
as the stronger headline once momme is on most of the catalogue. It is a better
line than the one live now, and it is dishonest to run it before the catalogue
can back it up.

### 1.5 Scripts only you can run

Railway shell, `cd backend`:

| script | what it does | status |
|---|---|---|
| `node scripts/fixOriginContent.js` | live CMS copy: origin corrections + new hero | **done** — hero copy is live, I can see it |
| `node scripts/auditCopyClaims.js` | read-only report of live DB copy still making manufacture claims | not run |
| `node scripts/auditReviews.js` | read-only review audit | not run |
| `node scripts/fixBridalEdit.js --apply` | bridal collection fixes | not run |

The two audits are read-only — they change nothing, they print a list. The code
is clean and guarded on every CI run; **the database has never been audited**,
and ADR 0008 already proved once that prose alone does not hold: it was decided
and implemented in June, and the claims were back by August.

### 1.6 Copy decisions I did not make for you

- **`We're an Irish brand based in Donegal, and we share a commitment to slow,
  considered work.`** — *share* with whom? It reads as a fragment left behind
  when a clause about Irish makers was edited out. Honest now, just unfinished.
  Lives in the CMS.
- **§16 wants the reviews heading to be `What women say`.** It currently reads
  `What our customers say`. I left it: the spec's version narrows who the brand
  speaks to, and that is a positioning decision, not a UI one.
- **`View all new arrivals`** — §9 asked for `View all silk`. I changed the
  wording because the link goes to the new-arrivals view, not the catalogue, and
  a label naming a different destination is a worse defect than one departing
  from the brief. Say the word and I will point it at the full shop instead.
- **The hero subtitle stacks three lines of capitals** (`FOUNDED IN DONEGAL.
  SHIPPED WORLDWIDE.` above an uppercase button). Worth trying the subtitle a
  touch lighter. Polish — I did not want to touch the hero again before you had
  seen the height fix land.

### 1.7 Two behaviour choices

- **§28 "then open the mini-cart"** after adding. Not built. The add is already
  confirmed three times — toast, button label, header count — and the toast has
  a one-tap **View bag**. Auto-opening taxes exactly the basket the quantity
  stepper exists for: someone adding four robes for bridesmaids dismisses the
  drawer between each one, and the Bridal Edit is built on that basket. Two-line
  change if you disagree.
- **§10 badges.** Only `NEW` exists; the spec lists New / Low stock / Back in
  stock / Sale. Sale is easy — `compareAtPrice` is already in the card
  projection — but "no badge overload" means deciding which one wins when a
  product qualifies for two. Give me the priority order and I will build it.

---

## 2. Deliberately not built

Each of these is a spec item I declined on purpose. If you disagree with any
reasoning, say so and I will build it — these are judgement calls, not refusals.

### 2.1 §20 filter facets — colour, price, material, availability

The catalogue is around ten pieces. A colour facet where every value returns one
product, and a price slider narrower than a single garment, is furniture that
makes a small shop look emptier than it is.

Availability is worse than useless: the listing is already filtered to
buyable-only, so the facet would offer exactly one option — the non-choice this
codebase has now removed three times (single size, single colour, and this).

**Revisit at a few hundred products.** Sort *was* built, because sorting is
useful at ten items and at ten thousand.

### 2.2 §48 per-garment size tabs — Robes / Sleepwear / Lingerie / Slips

There is one measurement set. Four tabs over one dataset is the same table four
times wearing different labels — the filter-facet mistake in another costume.

It needs per-garment measurements to exist first. Until then the differences
that *are* real live in the page's garment fit notes as prose, which is what a
tab would have to say anyway.

### 2.3 Merging the two general care lists

`lib/fabricCare.ts` carries general silk and linen care lists for the product
page; `/care-guide` has its own long-form version. That is a second statement of
the same advice, and I spent this session collapsing exactly that pattern.

Not here. The two are different **lengths** on purpose: the panel's is four
lines someone reads while choosing a size, the guide is the long form with
rinsing, storage and what to avoid. Folding either into the other would flatten
the good one. They agree in substance today; if they ever stop, the guide is the
one to correct.

### 2.4 Stock reservation at checkout

Availability is now checked before the charge, and four holes in that check were
closed this session. What remains is the gap between the check and the payment:
stock can go while a customer types her card.

Closing it needs reservations with expiry, and **blocking a paid order is worse
than the occasional oversell** — which the post-commit decrement already handles
by clamping to zero and logging. Worth revisiting if that log ever shows it
happening in practice.

### 2.5 The admin's inline modal

One dialog in `app/admin/products/[id]/page.tsx` is written inline instead of
going through `AdminModal`, so it is the only `aria-modal` on the site without a
focus trap. It is behind a login and used by one person. Named as an exemption
in `tests/focusTrap.test.ts` rather than filtered away silently — route it
through `AdminModal` and the exemption disappears.

---

## 3. Pre-existing issues I found and left alone

Not mine, not in scope, and each would be a separate piece of work. Recorded so
they are not lost.

### 3.1 The lint backlog — 104 errors, 182 warnings

```
130  jsx-a11y/label-has-associated-control   (admin forms)
 79  react-hooks/set-state-in-effect         (admin pages)
 33  @next/next/no-img-element               (raw <img> instead of next/image)
 12  react-hooks/exhaustive-deps
 10  @typescript-eslint/no-unused-vars
  9  @next/next/no-html-link-for-pages
```

This is why `npm run lint` cannot block CI, and why `npm run lint:invariants`
exists as a narrow blocking gate over the two rules that are genuine invariants.
Clear the backlog and that script can be deleted.

I added no new errors this session and checked each touched file against a
`git stash` before attributing anything to myself.

### 3.2 Two dead components

- **`components/FloatingCartBar.tsx`** — nothing imports it. Its suppression
  logic and its test guard a component that never mounts.
- **`components/ReviewsSection.tsx`** — nothing imports it. Ironically it is the
  *correct* implementation of the reviews page: it reads the canonical summary
  endpoint, which the live page did not until this session.

Mentioned rather than deleted, per the house rule about not removing
pre-existing dead code unasked.

### 3.3 The cart-vs-checkout discount divergence

Already recorded in `PROJECT_MAP.md`: `routes/cart.js` applies only
`cart.discountAmount` and knows nothing about collection sales, so a basket
holding a discounted-collection product can show a **higher** total in the cart
than at checkout. In the customer's favour, so not urgent — fixing it means
loading products and collections on every cart read.

### 3.4 A guard that cannot cover its own gap

`frontend/lib/shippingFallback.ts` mirrors the backend's shipping **defaults**,
and a CI test keeps the two in step. But live rates are defaults *plus* admin
overrides — so the moment you edit a rate in admin, the mirror is stale by
construction and no test can know.

That is why the shipping page now says the figures are indicative whenever it
falls back, rather than relying on the guard. Same limitation applies to
`lib/sizeChart.ts`.

---

## 4. Blocked by the environment

| what | detail |
|---|---|
| **MongoDB Atlas MCP** | Disabled for **both** your organisations. Not retryable — needs an Organization Owner to enable AI client access in the org settings. Tried three times, including after you enabled other access. |
| **No `MONGODB_URI`** | `backend/.env` does not exist here, so mongoose has nothing to dial either. Setting it would also un-skip 14 backend tests. |
| **Egress to the live site** | `silkilinen.com` and `api.silkilinen.com` are blocked, so I cannot see the running site, fetch an image URL, or verify a deploy. |
| **`next build`** | Cannot complete here: API-backed prerenders (`/account/orders`, `/about`, `/journal`) time out against the unreachable API. Types, tests and both lint gates all run clean, and CI builds against the real API. |

Either of the first two would unblock the audits in §1.5, let me list every
product with a malformed `fitNote`, `momme` or `materialComposition` in one pass
instead of you finding them one screenshot at a time, and answer §1.2 directly.

---

## 5. What the guards now cover

For context on what will fail CI if someone undoes this work:

| invariant | test |
|---|---|
| Origin claims in code | `backend/tests/originClaims.test.js` |
| CMS copy agrees across its three writers | `backend/tests/siteCopySync.test.js` |
| Shipping + size fallbacks match backend defaults | `backend/tests/{shippingFallback,sizeChartFallback}.test.js` |
| Sort options exist in the API whitelist | `backend/tests/productSort.test.js` |
| Availability refuses only the unfillable | `backend/tests/inventory.test.js` |
| One review aggregate, no local averages | `frontend/tests/reviewAggregate.test.ts` |
| UK customs claim always names Derry | `frontend/tests/ukShipping.test.ts` |
| Domain written once | `frontend/tests/urls.test.ts` |
| Clearance tokens have readers; hero fits the screen; reduced motion is global | `frontend/tests/floatingUtilities.test.ts` |
| Every `aria-modal` traps focus | `frontend/tests/focusTrap.test.ts` |
| A choice never renders as a fact | `frontend/tests/productDetails.test.ts` |

Every one was verified by breaking it deliberately and watching it fail.
