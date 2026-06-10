# Storefront trust plan — making the €200 buyer comfortable

Context: a €150–200 silk robe is a considered, often gift-related purchase. Before
she buys, a first-time visitor silently needs three things answered:
**1) is this a real brand with genuinely good silk, 2) will it fit and can I
return it, 3) is it worth the price?**

This doc lists what's **already shipped in code** vs what **needs you** (data,
photos, config) to fully close those gaps. Work top-down — they're in impact order.

---

## ✅ Already done in code (this branch)
- **Reassurance row** under New Arrivals (Free shipping / 14-day returns / Gift-ready) — the "this is a service, not a transaction" signal.
- **/gift-wrapping** page (so the gift-ready block links somewhere real).
- **Star ratings on product cards** + ratings in the list API.
- **Mobile sticky add-to-bag** on the live PDP.
- The PDP already has: gallery + video, colour variants, **Material & care** accordion, shipping/returns, Drop-a-Hint, Product/Review JSON-LD, breadcrumbs.
- Free-shipping progress already lives in the cart.

You don't need to touch any of the above — just review it on the Vercel preview.

---

## 1. Turn on automatic review requests  ⭐ highest impact
**Why:** Most products have **zero reviews** — the single biggest trust gap for a
considered buyer. You already have the sender (`backend/scripts/sendReviewRequests.js`);
it just isn't scheduled. It emails buyers ~14 days after purchase, once per order.

**Do this (Railway, ~3 min):**
1. Railway → your **backend** service → **Settings → Cron Jobs** (or add a new
   Cron service pointing at the backend image).
2. Add a job:
   - Schedule: `0 9 * * 1` (every Monday 09:00)
   - Command: `node scripts/sendReviewRequests.js --send`
3. Save. It's idempotent (marks `reviewRequestSentAt`), so re-runs never double-send.

> Tip: run it once without `--send` first (`node scripts/sendReviewRequests.js`) from a
> Railway shell to see a dry-run of who would be emailed.

## 2. Import your existing Etsy reviews onto products  ⭐
**Why:** You have history and a 4.9★ reputation — but it isn't attached to the
products on-site. Reviews on the PDP + star snippets in Google are what convert.

**Do this:**
- In **Admin → Reviews**, add/import reviews and **link each to the matching
  product** (the review model supports `productId`). Bulk Etsy imports can be set to
  `status: approved`.
- Even 2–3 reviews per hero product (the €168 robes, the blush briefs) changes how
  trustworthy each page feels.
- Once linked, star ratings appear automatically on cards and the PDP rating schema fills in.

## 3. Fill the quality + fit detail on each product  ⭐
**Why:** This is what answers "is it worth €200?" and "will it fit?". The fields
exist — they're just empty, so the accordion/specs don't show.

**Per product, in Admin → Products:**
- **Care instructions** (`careInstructions`) — e.g. "Hand wash cold, dry flat, do not
  tumble." Makes the **Material & care** accordion appear = longevity = justifies price.
- **Material composition** — make it specific: "100% Mulberry silk, 22 momme" rather
  than just "silk". Momme weight is a quality signal luxury buyers look for.
- **Fit note in the description** — one line like *"Relaxed fit. Model is 5'9" and wears
  S. Size down if between sizes."* Removes the biggest hesitation on intimates.

> If you'd like dedicated **Momme** and **Fit note** fields (instead of putting them in
> the description), tell me and I'll add them to the product model + admin editor + PDP.

## 4. Photography per hero product
**Why:** She can't touch the silk — the images have to do it.
- One **macro fabric close-up** (shows the sheen/weave).
- One **on-body movement shot or short video** (you already support `productVideo`).
- Multiple angles + a detail shot (seam/finish).
Upload via Admin → Products → images. Prioritise the €168 kimono robes and the bestsellers.

## 5. Express checkout (Apple Pay / Google Pay)
**Why:** At the top of your price range, one-tap pay measurably lifts conversion.
- In **Stripe Dashboard → Settings → Payment methods**, enable **Apple Pay** and
  **Google Pay**, and verify your domain (`silkilinen.com`) for Apple Pay.
- Tell me once it's enabled and I'll confirm the checkout surfaces the express buttons
  (the Stripe Payment Element shows them automatically when eligible).

## 6. (Optional, taste) Move social proof higher on the homepage
**Why:** Your 4.9★ / 56-review section currently sits ~5 sections down. A slim
"4.9★ · loved by 56+ customers" line near the top builds trust before she scrolls.
This is a **look** decision — say the word and I'll add a compact proof line under the
hero (or move the reviews section up) for you to preview.

## 7. (Optional) Edit the reassurance row copy
The three blocks default to Free Shipping / 14-day Returns / Gift-Ready. To change the
services or wording, edit `ITEMS` in `frontend/components/ReassuranceRow.tsx` — or tell
me what you'd prefer and I'll change it.

---

### The short version
Code-side, the trust scaffolding is in. The remaining wins are **content**: reviews
(#1, #2), product detail (#3), and photography (#4). Those three are what turn a
nice-looking site into one a €200 buyer trusts enough to check out.
