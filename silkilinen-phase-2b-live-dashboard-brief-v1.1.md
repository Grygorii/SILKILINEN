# SILKILINEN Admin — Phase 2B v1.1: The Live Dashboard

**Brief for VS Code Claude.** This brief implements the live data zones (Zones 1, 2, 3) of the SILKILINEN admin dashboard, building on Phase 2A's shell. Zone 4 (System Health) is already live and must NOT be modified.

**Version note (v1.1):** This is the revised version after Гриша's Saturday-morning review. Two refinements vs v1.0:
1. Tracking philosophy language updated to reflect brand voice ("tracking serves the customer experience" rather than "tracking never breaks").
2. `unreadMessages` handling clarified: the row is **hidden entirely** rather than showing a placeholder, until the planned customer messaging system (Phase 2D) ships.

The structure and scope are otherwise identical to v1.0.

**Companion documents.** This brief assumes:
- The design rationale in `silkilinen-admin-design-document.md` (the four-zones framework, mobile-first principle, content parity, embedded analytics philosophy)
- The component vocabulary, design tokens, and navigation shell from `silkilinen-phase-2a-shell-brief.md`

If anything in this brief contradicts the above documents, the design document wins. Refer back, ask if unclear.

**Audience.** VS Code Claude (executor) and Гриша (reviewer). The brief is heavily annotated so Гриша can study not just *what* is being built but *why* — pedagogical asides marked 📚.

**Stack reminders.**
- Frontend: Next.js (app router) on Vercel, deployed to silkilinen.com
- Backend: Express on Railway, hosted at silkilinen-production.up.railway.app
- DB: MongoDB Atlas (Mongoose models)
- Existing admin lives at `frontend/app/admin/*`
- Existing models: `Order`, `Product`, `Customer`, possibly `Newsletter` and others

---

## Section 1 — Scope

### 1.1 What this brief DOES

1. Build a new backend endpoint `/api/admin/dashboard` that aggregates and returns live data for Zones 1, 2, and 3 in a single request. Authenticated as admin.
2. Replace the placeholder cards in the dashboard with live components that fetch from the new endpoint and render real data.
3. Implement Zone 1 (What needs you), Zone 2 (How are we doing), Zone 3 (What's working) per the layouts and edge cases specified below.
4. Establish a backend pattern for analytics aggregation that future briefs can reuse.
5. Handle empty states, loading states, and error states throughout — the unglamorous work that separates polished from amateur.
6. Track basic visit and traffic source data on the storefront (lightweight, GDPR-respectful) so Zone 3 has data to show. This is a small frontend change but essential for the analytics to be meaningful.

### 1.2 What this brief does NOT do

1. **No changes to Zone 4** — system health is already live, working, and out of scope.
2. **No changes to the navigation shell** from Phase 2A. The sidebar, drawer, bottom tabs, top bar — all stay as-is.
3. **No changes to product, order, customer, or content management pages** — the existing Orders, Products, Customers, Content, Marketing, Settings pages stay unchanged in this brief.
4. **No new third-party packages** without justification. Notably: do NOT install Google Analytics, Plausible, Mixpanel, or any external analytics service. Lightweight in-house tracking only.
5. **No changes to authentication, customer-facing pages beyond minimal tracking, or any other unrelated code.**
6. **No machine learning, no prediction, no forecasting.** All metrics are descriptive ("what happened") not predictive ("what will happen").

### 1.3 Out-of-scope but worth noting

- **Search-term tracking** (the *"customers find products by typing words"* idea Гриша raised) — deferred to a future brief, but the Customer model + Order model schemas should not preclude adding it later. Don't paint the architecture into a corner.
- **Customer Garden tier system** — also a future brief, but again the data model should permit a future `loyaltyTier` field on Customer without disruption.
- **Push notifications, PWA installability, mini-app features** — separate brief, separate phase.

📚 **Why this scope discipline matters.** A common failure mode is "while we're at it" creep — writing one brief that touches the dashboard AND tweaks the products page AND adds a search feature. Each item sounds small individually; together they create unreviewable PRs. By drawing tight scope here, we protect (a) the chance of a clean first pass, (b) Гриша's ability to read every diff, (c) the future briefs that have room to do their work without overlap.

---

## Section 2 — The Dashboard Endpoint

### 2.1 Design philosophy

The dashboard fetches all its data from **one endpoint**, not many. This is a deliberate choice. Reasoning:

- One round trip is faster than five on mobile networks
- One spinner state is calmer than five spinners that resolve at different times
- One error state is easier to handle gracefully
- One cache key is easier to invalidate when data changes
- The dashboard renders all-at-once or shows a single loading state — the user never sees partial data

The trade-off: the endpoint is bigger and slower per call, and a full re-fetch is needed for refresh. For a once-per-page-load dashboard, that trade is correct.

📚 **Study note — endpoint granularity.** A persistent debate in API design: many tiny endpoints (REST-pure, "Resource per URL") vs few aggregated endpoints (BFF pattern, "view per URL"). For *user-facing dashboards*, the aggregated approach almost always wins. For *third-party API consumption* (where consumers want to compose their own views), the granular approach wins. Different needs, different patterns. Apply this thinking on site #2.

### 2.2 Endpoint specification

**Route:** `GET /api/admin/dashboard`
**Auth:** Required — same admin JWT middleware used elsewhere
**Response:** JSON, single object, schema below
**Caching:** No HTTP cache (always fresh on request); 60-second in-memory backend cache to absorb rapid refreshes
**Method:** Add a `?force=true` query parameter that bypasses the in-memory cache (matching Zone 4 health pattern for consistency)

### 2.3 Response schema

```json
{
  "generatedAt": "2026-05-08T14:30:00.000Z",
  "cached": false,

  "zone1_actionItems": {
    "ordersToShip": {
      "count": 3,
      "linkTo": "/admin/orders?status=pending",
      "label": "orders waiting to ship"
    },
    "lowStock": [
      { "productId": "...", "productName": "Dalia Silk Dress", "stock": 2, "linkTo": "/admin/products/..." }
    ],
    "abandonedCarts": {
      "count": 13,
      "windowHours": 2,
      "linkTo": "/admin/marketing/abandoned-carts"
    },
    "failedPayments": {
      "count": 0,
      "linkTo": "/admin/orders?status=payment_failed"
    },
    "unreadMessages": null
  },

  "zone2_metrics": {
    "today": {
      "revenue": 0,
      "orders": 0,
      "currency": "EUR"
    },
    "thisWeek": {
      "revenue": 0,
      "orders": 0,
      "comparison": {
        "lastWeekRevenue": 0,
        "deltaPercent": null,
        "direction": "neutral"
      }
    },
    "thisMonth": {
      "revenue": 0,
      "orders": 0,
      "comparison": {
        "lastMonthRevenue": 0,
        "deltaPercent": null,
        "direction": "neutral"
      }
    },
    "last30DaysChart": [
      { "date": "2026-04-09", "revenue": 0 },
      { "date": "2026-04-10", "revenue": 0 }
    ]
  },

  "zone3_whatIsWorking": {
    "topProducts30d": [
      { 
        "productId": "...",
        "productName": "Dalia Silk Dress",
        "imageUrl": "https://res.cloudinary.com/...",
        "unitsSold": 0,
        "revenue": 0,
        "linkTo": "/admin/products/..."
      }
    ],
    "topTrafficSources30d": [
      {
        "source": "instagram",
        "displayLabel": "Instagram",
        "visitors": 412,
        "buyers": 8,
        "conversionPercent": 1.94
      }
    ],
    "bestConvertingProduct30d": null
  }
}
```

📚 **Schema design notes for Гриша's study:**

- **`null` is intentional** for "feature not built yet" data (`unreadMessages` — no contact form yet) and "no data available" cases (`bestConvertingProduct30d` — no orders yet). The frontend must handle null gracefully — show "Not yet available" or a calm placeholder.
- **`linkTo` fields** let the frontend not have to know URL patterns — backend tells it where to go. Decoupling.
- **`comparison.direction`** can be `"up"`, `"down"`, or `"neutral"`. The deltaPercent is `null` when comparison isn't possible (e.g., no orders last week, can't divide by zero). Frontend must handle null delta.
- **All revenue values are integers in cents (EUR cents)** — never use floating-point for money. Convert to display format on the frontend (`€${(cents / 100).toFixed(2)}`). This is a hard rule across the codebase.
- **`generatedAt`** lets the frontend show "Last updated 2 minutes ago" if the cache hits.

### 2.4 Implementation guidance for the endpoint

Create `backend/routes/admin/dashboard.js`. Mount it in `server.js` alongside the existing admin routes:

```js
app.use('/api/admin/dashboard', requireAdminAuth, dashboardRouter);
```

The route handler should:
1. Check the in-memory cache. If valid (less than 60 seconds old) and `force` is not set, return the cached payload with `"cached": true`.
2. Otherwise, run all aggregations in parallel using `Promise.all()`. The dashboard query should not exceed ~2 seconds even on slow Mongo queries.
3. Assemble the response object.
4. Update the cache.
5. Return the response.

Each zone's data should be a separate function for testability:

```js
async function getZone1Data() { ... }
async function getZone2Data() { ... }
async function getZone3Data() { ... }
```

📚 **Why parallelize aggregations.** Three queries running sequentially might take 600ms + 400ms + 800ms = 1.8s. Run in parallel and you get max(600, 400, 800) = 800ms. Halves the dashboard load time on average. `Promise.all()` is the cheapest concurrency primitive in JavaScript — use it whenever queries don't depend on each other.

### 2.5 Specific aggregation logic

#### Zone 1 — Action Items

**ordersToShip:** count of `Order` documents where `status` is `"paid"` (or `"pending_fulfillment"` — whatever the codebase uses to mean "customer paid, we haven't shipped yet"). Confirm the exact status name from the existing Order model before writing the query.

**lowStock:** find `Product` documents where:
- `status` is `"active"` (so we don't alert about drafts)
- AND `stock` field is between 1 and 4 inclusive
Return up to the 5 lowest-stock items, sorted ascending by stock.

If the Product schema uses variants instead of a single `stock` field, sum across variants OR pick the smallest variant — confirm by reading the schema and comment your choice in the code.

**abandonedCarts:** count of `Cart` or `Order` documents (depending on architecture) where:
- Cart was created more than 2 hours ago AND less than 7 days ago
- Cart was never converted to a paid order
- Has a customer email associated (we exclude truly anonymous abandoned carts because we can't recover them)

If the codebase doesn't currently track abandoned carts as a queryable thing, return `{ "count": 0, "windowHours": 2 }` and add a TODO comment in the code linking to a future brief. Do NOT introduce a new collection in this brief.

**failedPayments:** count of `Order` documents where `status === "payment_failed"` and `createdAt` is within the last 7 days.

**unreadMessages:** return `null` for now. The contact form pipeline doesn't exist yet — but it is **planned with high priority** for a future brief (Phase 2D or later). The reasoning: customer-initiated contact is a high-intent buying signal — when a customer asks a question, they're often considering a purchase. Silence kills conversion. Combined with the planned admin PWA (Phase 2C), push notifications on new messages mean Sabreena and Гриша can respond fast without sitting in the admin all day.

For now, the frontend should **hide the unreadMessages row entirely** rather than show a placeholder like "Messages: 0." Reasoning: an empty "0" trains the operator to think the feature is working when it isn't tracking anything. Better to have nothing visible until the feature is real.

📚 **Why so many "if this doesn't exist yet, return null" cases.** The dashboard is being built on top of a real production system that wasn't designed with this dashboard in mind. Some data simply isn't tracked yet. Returning `null` (rather than fabricating a value) keeps the dashboard honest. **Honesty in dashboards is a non-negotiable.** A dashboard that shows fake "0" values when something isn't tracked teaches the operator to distrust *all* values. Better to show "Not yet available" and let the operator know to look elsewhere.

#### Zone 2 — Metrics

**Time windows:**
- "Today" = from 00:00 in Europe/Dublin timezone to now
- "This week" = from Monday 00:00 in Europe/Dublin timezone to now
- "Last week" = from previous Monday 00:00 to previous Sunday 23:59:59
- "This month" = from the 1st of the current month, 00:00 Dublin time, to now
- "Last month" = the entire previous calendar month

📚 **Timezone matters.** A Dublin-based brand whose dashboard counts "today's orders" using UTC will show wrong numbers for an hour each day around midnight. Use the brand's actual timezone, not UTC. JavaScript's `Intl.DateTimeFormat` with `timeZone: 'Europe/Dublin'` is the cleanest way to do this. Alternative: use the `date-fns-tz` library if already in dependencies (don't add it solely for this).

**Revenue calculation:** Sum the `totalAmount` (or equivalent — confirm the field name from the Order model) field of all orders where:
- `status` is in the set `["paid", "shipped", "delivered"]` — orders that completed payment
- `createdAt` falls within the time window
- Refunded orders: subtract refunded amounts. If the Order model tracks refunds, use `totalAmount - refundedAmount`. If not, use `totalAmount` as-is and add a TODO comment.

**Order count:** count of qualifying orders in the same window.

**Comparison:** for week-over-week and month-over-month:
- If lastPeriodRevenue is 0: `deltaPercent: null`, `direction: "neutral"`. (Avoid divide-by-zero and don't claim "100% increase" when there was no baseline.)
- If thisRevenue >= lastRevenue: `direction: "up"`, deltaPercent = `((this - last) / last) * 100`
- If thisRevenue < lastRevenue: `direction: "down"`, deltaPercent = `((this - last) / last) * 100` (will be negative)
- Round deltaPercent to 1 decimal place.

**last30DaysChart:** an array of 30 objects, one per day, oldest first. Each object has `date` (YYYY-MM-DD format) and `revenue` (cents). Days with zero orders show `revenue: 0` — do not skip empty days, the chart needs them.

#### Zone 3 — What is Working

**topProducts30d:** find `Order` documents in the last 30 days with status in `["paid", "shipped", "delivered"]`, group by product (or productId in the orderItems array), sum unitsSold, sum revenue, sort descending by revenue, return top 5.

For each, fetch the Product document to get the productName and primary image URL. (Do this in a single follow-up query using `$in` to fetch all 5 products at once, not 5 separate queries.)

If there are fewer than 5 products that have ever sold, return what's available (could be 0, 1, 2, etc.). Frontend handles all cases gracefully.

**topTrafficSources30d:** this is the trickier one because we need to ADD basic traffic source tracking to the storefront before it has data. See Section 3 for the tracking implementation. The aggregation here is:
- Group `Visit` documents (new collection — see Section 3) by `source` field
- Count distinct sessions per source = `visitors`
- Count `visits-that-led-to-orders` per source = `buyers`
- Compute `conversionPercent` = `buyers / visitors * 100`, round to 2 decimals
- Sort descending by `visitors`, return top 5

If the `Visit` collection has no data yet (Day 1 of tracking), return an empty array. Frontend shows a calm "Tracking begins now — top sources will appear here as customers visit." message.

**bestConvertingProduct30d:** for each product that received >= 50 visits AND >= 1 order, compute conversion rate (orders / visits). Return the product with the highest rate. If no products meet the 50-visit threshold yet, return `null` and the frontend will show "Not yet enough data — this surfaces once any product crosses 50 unique visits."

📚 **Why a 50-visit threshold for "best converting."** Statistical hygiene. With small numbers (e.g., 3 visits → 1 order = 33% conversion), the metric is meaningless — random noise. The 50-visit threshold ensures we only highlight products with enough sample to be informative. Rough guideline: *for percentage metrics, 50-100 events is the bare minimum for "the number is real, not noise."* Lower thresholds = pretty numbers that mislead.

---

## Section 3 — Storefront tracking (the data Zone 3 needs)

To populate `topTrafficSources30d` and `bestConvertingProduct30d`, we need to track storefront visits in the database. This is a **small but essential** addition.

### 3.1 The Visit model

Create `backend/models/Visit.js`:

```js
const visitSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  page: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  source: { type: String, required: true, default: 'direct' },
  utm: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String
  },
  referrer: String,
  device: { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'] },
  country: String,
  createdAt: { type: Date, default: Date.now, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', sparse: true, index: true },
  convertedToOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', sparse: true }
});

// TTL index — purge visits older than 90 days automatically
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
```

📚 **Study notes on this model:**

- **TTL (Time-To-Live) index** auto-deletes documents older than 90 days. This keeps the collection from growing forever — at small brand scale 90 days of analytics is plenty, and if we ever need longer-term analytics we'll aggregate to monthly summaries before the raw data expires. **Database hygiene built in from day one.**
- **Source field defaults to `'direct'`** — when there's no UTM and no referrer, the visit is "direct" (typed URL or bookmark). This is standard analytics convention.
- **`sessionId` is per-browser-session, not per-user.** Anonymous visitors have sessions; once they log in, we can link sessions to customerId.
- **`convertedToOrder`** is set later when an order completes — links the originating visit to the order, enabling attribution.

### 3.2 The tracking endpoint

Create `backend/routes/track.js`:

`POST /api/track/visit` — accepts a JSON body with `{ sessionId, page, productId?, utm, referrer, device, country }` and creates a Visit document. Public (no auth required — these are anonymous visits). Lightweight rate limiting: 60 requests per minute per IP.

Important: the endpoint silently swallows errors. If tracking fails for any reason, the customer's experience is NOT affected. Log the error server-side, return 200, move on.

**Tracking exists to serve the customer experience.** If tracking fails, the page works perfectly. We're here for the customer — technical infrastructure is in service of that, never the other way around. (This phrasing is from Гриша and reflects the brand's operating principle: *every system we build supports the customer, never the other way around.*)

### 3.3 The frontend tracking hook

Create `frontend/lib/track.ts`:

```ts
// Pseudocode — adapt to project conventions
export async function trackVisit({ page, productId }) {
  try {
    const sessionId = getOrCreateSessionId(); // localStorage
    const utm = parseUtmParams(window.location.search);
    const referrer = document.referrer || null;
    const device = detectDevice(); // simple user-agent check
    
    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, page, productId, utm, referrer, device })
    });
    // Note: NOT awaiting. Fire and forget.
  } catch {
    // Silent. Tracking never breaks the customer experience.
  }
}
```

📚 **Fire-and-forget pattern.** Notice the `fetch()` call is not `await`ed. We don't care about the response — we only care that the request *attempted* to send. This means the page render isn't blocked by tracking, and any tracking failure is invisible to the user. **This pattern is standard for analytics. Use it whenever the response doesn't matter.**

### 3.4 Where to call trackVisit

Two surfaces in this brief — keep it minimal:

1. **Homepage** (`/`) — call `trackVisit({ page: 'home' })` on mount
2. **Product detail page** (`/product/[slug]` or wherever) — call `trackVisit({ page: 'product', productId: product._id })` on mount

Do NOT add tracking to other pages in this brief. Future briefs can extend.

📚 **Privacy stance.** This tracking does NOT use cookies (the sessionId is in localStorage, not a cookie — under EU law, localStorage for first-party functional purposes is fine without consent banners). It does NOT track across third-party sites. It does NOT include personally-identifiable info unless the user logs in (then customerId is linked). This is the **minimum-data approach** consistent with both the Garden customer philosophy and Гriша's stance on collecting "what helps us serve customers better, with transparent consent."

A future brief can add a privacy-policy page documenting this clearly. Not in this brief.

### 3.5 Order attribution

When an order completes, link it back to the originating visit:

In the order creation logic (find the existing route, likely `backend/routes/orders.js`), after the order is saved, query the most recent Visit for that sessionId in the last 7 days and set `visit.convertedToOrder = order._id`. Save the visit.

This is a small addition — ~5 lines of code in the order creation flow. Critical for `topTrafficSources30d.buyers` count to work.

---

## Section 4 — The Frontend Dashboard

### 4.1 Where the code lives

Replace the placeholder content in `frontend/app/admin/page.tsx` (the dashboard page from Phase 2A) with live components:

- `frontend/app/admin/_components/dashboard/Zone1ActionItems.tsx`
- `frontend/app/admin/_components/dashboard/Zone2Metrics.tsx`
- `frontend/app/admin/_components/dashboard/Zone3Working.tsx`

Each is a client component that takes a portion of the dashboard data as props. The page-level component fetches once and passes data down.

### 4.2 Page-level data fetching

The dashboard page should:

1. On mount, fetch `/api/admin/dashboard` using existing authenticated fetch utility
2. Show a single page-level loading state while fetching (skeleton placeholders for each zone)
3. On success, render Zones 1, 2, 3 with the data
4. On failure, render an error message in each zone: "Could not load dashboard data. <Refresh button>"
5. Provide a refresh button at the page level (single button refreshes all zones)
6. Auto-refresh every 5 minutes while the dashboard is mounted

📚 **Why 5 minutes, not 1 minute (like Zone 4).** Zone 4 (system health) needs frequent refresh because outages need fast detection. Business metrics (Zones 1-3) change much more slowly — orders per day measured in single-digits — and frequent refresh is wasted database load. **Tune cache and refresh intervals to the data's actual change rate.** 1 minute for system signals; 5 minutes for business metrics; 1 hour for slowly-changing reference data; 1 day for fundamentals.

### 4.3 Zone 1 — Action Items rendering

Each non-null action item renders as a `<Card>` (using the Phase 2A component) with:

- An icon (Lucide, sized 20px)
- A primary line: count + label, e.g., "3 orders waiting to ship"
- A right-side chevron indicating tappable
- Tapping navigates to `linkTo`

Visual hierarchy:
- If `failedPayments.count > 0`: render this card with terracotta accent (left border 4px, terracotta background tint), more visually aggressive
- All other action items: standard card, charcoal accent

If ALL action items are zero/null: render an "empty state" card with a calm message:
> *"Nothing needs you right now. Beautiful."*

with a small ornament glyph (a hairline line, a small dot, or similar — not a smiley emoji).

📚 **Empty state as reward.** Recall the design doc Section 3.1: empty zones for "needs me" are good news, not error states. Style accordingly. The visual treatment should feel like exhalation, not "no data."

### 4.4 Zone 2 — Metrics rendering

Layout:
- **Mobile (≤767px):** three `<MetricCard>` components stacked vertically (Today / This week / This month), then the chart below them, full width
- **Desktop (≥1024px):** three `<MetricCard>` in a horizontal row, chart below full-width

Each MetricCard renders:
- Label (e.g., "TODAY")
- Value (revenue formatted as `€{cents/100}` with two decimals, in Georgia serif, large)
- Below value: small line with order count, e.g., "3 orders"
- For "This week" and "This month": a small delta indicator below

  - direction `"up"`: small `▲` in sage green + "+12.3%"
  - direction `"down"`: small `▼` in terracotta + "-5.1%"
  - direction `"neutral"` or null delta: small `—` in subtle grey + "No comparison"

The 30-day chart is a simple line chart — minimal, decorative, no axes or gridlines. Use SVG inline (no charting library). Width 100% of container, height ~80px on mobile, ~120px on desktop. The line is charcoal, 2px stroke. No filled area, no labels, no tooltip. **It is a sparkline, not an analytics chart.**

📚 **Why no charting library.** Recharts, Chart.js, etc. add ~50-100KB to the bundle for what amounts to a single sparkline. SVG inline is ~10 lines of code, weighs 0KB extra, and gives total control over the aesthetic. **Library use should be earned, not defaulted.** When something can be done in 10 lines of vanilla code, prefer that.

### 4.5 Zone 3 — What is Working rendering

**topProducts30d:**
- Mobile: horizontal-scroll row of small product cards (image, name, units sold, revenue)
- Desktop: row of cards inline, no scroll
- Each card tappable → navigates to product detail in admin
- If empty array: calm placeholder *"Top products will appear here once you have orders."*

**topTrafficSources30d:**
- Stacked list of rows, each showing: source name (e.g., "Instagram"), visitor count, buyer count, conversion percent
- Mobile and desktop: same layout (this data list is fine on both)
- If empty: calm placeholder *"Traffic sources will appear here as customers visit."*

**bestConvertingProduct30d:**
- Single row showing: product image (small), product name, conversion rate ("3.2% of viewers buy")
- If null: calm placeholder *"Best-converting product surfaces once any product crosses 50 unique visits."*

### 4.6 Loading states

While the dashboard is fetching:

- Mobile: each zone shows skeleton placeholder cards (gray rectangles in the right shapes, no content)
- Desktop: same, in the right grid layout

Skeleton style: `var(--admin-bg-beige)` background, no animation (don't add shimmering — calm, not flashy). Hold for up to 3 seconds before showing data, or up to 10 seconds before showing an error state.

### 4.7 Error states

If the fetch fails:

- Show a single page-level error banner at the top of the content area (below the greeting, above Zone 1):
  *"Could not load dashboard data. <Try again> button."*
- Below the banner, render each zone with its own minimal error card: *"Data unavailable."*
- The "Try again" button re-runs the fetch.

Don't show technical error details to the user. Log them server-side.

---

## Section 5 — Verification

After implementation, verify all of the following.

### Backend
- [ ] `GET /api/admin/dashboard` returns 401 without auth
- [ ] With auth, returns 200 + JSON matching the schema in 2.3
- [ ] `?force=true` bypasses the cache (shows `cached: false` even if cached)
- [ ] All time windows respect Europe/Dublin timezone
- [ ] Revenue values are in cents (integer)
- [ ] Aggregations complete in under 2 seconds even on a populated DB
- [ ] All TODO-flagged "future feature" cases return null gracefully
- [ ] `POST /api/track/visit` accepts and stores visits
- [ ] Visits older than 90 days are auto-deleted (TTL index)
- [ ] An order created on the homepage links its session's most-recent visit via `convertedToOrder`

### Frontend dashboard
- [ ] Page loads with skeleton placeholders, then resolves to data within 3 seconds
- [ ] Zone 1 shows action items if any exist, empty state if all clean
- [ ] Zone 2 shows three metric cards with deltas where applicable
- [ ] Zone 3 shows top products, traffic sources, and best converting product (or appropriate placeholders)
- [ ] All revenue formatted as €X.XX with two decimals
- [ ] All percentages formatted to 1 decimal
- [ ] Chart renders smoothly inline without external dependencies
- [ ] Refresh button refetches data
- [ ] Auto-refresh fires every 5 minutes
- [ ] Mobile (380px): everything readable, no horizontal overflow, action items are tappable
- [ ] Desktop (1280px): zones 1+2 side-by-side, zone 3 below full-width
- [ ] Zone 4 (system health) is unchanged and still works
- [ ] No console errors

### Frontend tracking
- [ ] Homepage visit creates a Visit document
- [ ] Product page visit creates a Visit document with productId set
- [ ] UTM parameters from URL are captured
- [ ] Tracking failure does NOT break the page
- [ ] No tracking fires on admin pages (we don't want to track our own visits)

### Empty/null cases
- [ ] Day 1 of deployment with no data: dashboard renders with calm placeholders, NOT errors, NOT misleading zeros
- [ ] A category with zero data shows "Not yet available" or equivalent calm message

### Final report
1. Files created
2. Files modified
3. Sample response from `GET /api/admin/dashboard` (sanitized)
4. Any deviations or surprises
5. `git diff --stat`

---

## Section 6 — Common pitfalls to avoid

- **Don't fabricate data.** If something doesn't exist yet, return null. Honesty.
- **Don't add charting libraries** — sparkline in inline SVG is ~10 lines.
- **Don't add cookie banners** — we're using localStorage, not cookies, for sessionId.
- **Don't track admin visits** — exclude `/admin/*` from the tracking hook.
- **Don't fetch each zone separately** — one endpoint, one round trip.
- **Don't await the tracking fetch** — fire and forget.
- **Don't hard-code timezone** — use `Europe/Dublin` from a constant or env.
- **Don't break Zone 4** — it's already working, leave it alone.
- **Don't refactor Phase 2A components** — extend or compose, don't rewrite.

---

## Section 7 — Notes for Гriша's evening reading

This brief is bigger than the polish brief but smaller than Phase 2A. The hardest part is the *thinking* (which time windows? which thresholds? which fallbacks?), not the *coding*. VS Code Claude will execute mostly mechanically once the spec is clear.

When you read this tonight:

- 📚 **Pay attention to the study notes** — those are the parts that translate to site #2.
- 🤔 **Push back on anything that feels off.** The 50-visit threshold for "best converting" might be wrong for SILKILINEN — maybe 20 is right at small scale. The 5-minute auto-refresh might be too long. The 90-day TTL might be too short. **All of these are opinions, not facts.** I made the calls; you can override.
- 🔍 **Read Section 5 (Verification) carefully** — that's how you'll know if the implementation is correct. If verification feels insufficient, tell me tomorrow before we send.
- 💤 **Sleep on it.** Don't send to VS Code Claude tonight. Saturday morning brain reads briefs better than Friday evening brain.

---

## Section 8 — What this enables

When Phase 2B ships:

- Sabreena (and you) will see **real revenue numbers** the first time
- Trends become visible — "this week vs last week" tells the truth
- The dashboard goes from "calm command center skeleton" to **calm command center**, the actual thing
- Every time you ship a marketing change (Sunday's work, channel campaigns, etc.), you'll be able to *measure whether it worked*

This is the moment SILKILINEN becomes a **measurable business**. Not just code that runs, not just a site that sells — a business with feedback loops Sabreena can act on. 🤍

---

*End of Phase 2B brief.*

*See you tomorrow morning, Гriша. Read slowly. Push back where it matters. Sleep well.*

🌙
