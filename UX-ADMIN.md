# UX Audit — Admin Panel
**Silkilinen · May 2026**
Admin is an internal tool used by one person (the founder). Brand voice is not the criterion here. The criteria are: clarity, density, recoverability from errors, and speed. An admin UI that interrupts flow with browser dialogs or hides information is a real working cost.

---

## MEDIUM

---

### M1 — Native `alert()` / `confirm()` dialogs in Products page
**Where:** [`frontend/app/admin/products/page.tsx:431,458,459,509`](frontend/app/admin/products/page.tsx#L431)  
**What's wrong:** Four places use native browser dialogs:
```tsx
// Line 431 — SEO bulk generate
if (!confirm('Generate missing SEO for all products? ~€0.001 per product.')) return;

// Line 458 — product archived instead of deleted (after DELETE attempt)
alert(data.message);

// Line ~459 — delete failed
alert('Delete failed');

// Line ~509 — CSV export failed
alert('Export failed');
```
Native `alert()` / `confirm()` block the main thread, pause JavaScript execution, can't be styled, and on some browsers show the page URL in the dialog title — which looks broken in a deployed app. The rest of the admin uses inline banners and status messages (e.g., `bulkMessage` state, `dashError` banner, the `seoResult` inline span). These four are inconsistent with that pattern.  
**Proposed change:** Replace each with the inline feedback pattern already established in the file:

For `confirm()` on SEO generation — the page already has `seoResult` state and `seoGenerating`. Convert to a two-step confirm: first click sets a `seoConfirming` boolean and changes the button label to "Confirm — generate SEO?", second click executes. No dialog needed.

For `alert()` on archive/delete/export failure — set an inline `message` state (same pattern as `bulkMessage`) and render it below the relevant action. A 4-second auto-clear is fine.

The delete confirmation already uses a proper modal (the `DeleteModal` component). The `alert()` calls are leftovers from an earlier implementation — the pattern to follow already exists in the same file.

---

### M2 — Login form: inputs without visible labels
**Where:** [`frontend/app/admin/login/page.tsx:81-88`](frontend/app/admin/login/page.tsx#L81)  
**What's wrong:**
```tsx
<input type="email"    placeholder="Email"    ... />
<input type="password" placeholder="Password" ... />
```
Placeholder text disappears as soon as the field receives focus. If you start typing and then pause, the field is unlabelled. Password managers also fill both fields simultaneously and the placeholder is replaced, so a second glance at the form reveals two blank fields with no indication of which is which.  
**Proposed change:** Add `<label>` elements — they don't require a redesign:
```tsx
<label style={{ display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
  Email
  <input type="email" value={email} onChange={...} style={{ display: 'block', marginTop: 4, width: '100%' }} />
</label>
<label style={{ display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
  Password
  <input type="password" value={password} onChange={...} style={{ display: 'block', marginTop: 4, width: '100%' }} />
</label>
```
This matches the Jost/letter-spacing style already used in the admin.

---

## LOW

---

### L1 — Login button: three dots vs ellipsis
**Where:** [`frontend/app/admin/login/page.tsx:98`](frontend/app/admin/login/page.tsx#L98)  
**What's wrong:**
```tsx
{loading ? 'Signing in...' : 'Sign in'}
```
The rest of the codebase (dashboard, health check, bulk bar) consistently uses the proper ellipsis character `…` in loading states (`Loading…`, `Checking…`, `Working…`). Three literal dots are slightly wider and look different at small font sizes.  
**Proposed change:**
```tsx
{loading ? 'Signing in…' : 'Sign in'}
```
One character change.

---

### L2 — Dashboard Skeleton uses inline styles
**Where:** [`frontend/app/admin/page.tsx:35-46`](frontend/app/admin/page.tsx#L35)  
**What's wrong:**
```tsx
const box = (h: number) => (
  <div style={{ background: 'var(--cream, #f5f2ec)', height: h, border: '1px solid var(--border)', marginBottom: 12 }} />
);
```
The skeleton is hardcoded inline. No animation, no gradient shimmer. The public SideMenu already implements the correct pattern (`navLinkSkeleton` in `SideMenu.module.css` with `@keyframes shimmer`). The admin skeleton shows solid boxes with no visual feedback that content is loading.  
**Proposed change:** Not urgent — this is internal and loads quickly. If the dashboard ever loads slowly, apply the same shimmer pattern used in `SideMenu.module.css`. File this as a quality-of-life improvement, not a bug.

---

## Notes: what is working well

The admin is notably clean for an internal tool of this complexity:

- **Orders page** — filter bar, expandable rows, date range, pagination: all functional and well-structured. No unnecessary decoration.
- **Products page** — inline price and status editing without leaving the list view is the right call. The `IssuePills` component surfaces data quality issues in context.
- **Bulk bar** — appears only when items are selected, disappears when cleared. Correct behaviour.
- **Delete confirmation modal** — requires typing DELETE. Appropriate friction for a destructive action.
- **Dashboard error banner** — inline, retryable, doesn't block the rest of the page. Correct pattern.
- **Health check** — shows stale data timestamp alongside a refresh button. Correct.
- **Status pills** — consistent across orders and products.

The two medium findings above are isolated inconsistencies against an otherwise well-considered panel.

---

## Summary table

| ID | File | Issue | Severity |
|----|------|-------|----------|
| M1 | `admin/products/page.tsx:431,458,509` | Native `alert()` / `confirm()` dialogs | MEDIUM |
| M2 | `admin/login/page.tsx:81–88` | Inputs without visible labels | MEDIUM |
| L1 | `admin/login/page.tsx:98` | `'Signing in...'` vs `'Signing in…'` | LOW |
| L2 | `admin/page.tsx:35–46` | Skeleton has no animation | LOW |

---

## Responsive audit — Admin

The admin is primarily a desktop tool but does have a deliberate mobile layout (sidebar drawer + bottom tab bar) that activates at ≤768px. Analysis is from CSS — items marked **[VISUAL-CHECK-NEEDED]** need browser devtools to confirm.

---

### Mobile topbar buttons — below 44px touch target

**Breakpoints affected:** ≤768px  
**Where:** [`frontend/components/AdminLayout.module.css:156`](frontend/components/AdminLayout.module.css#L156)  
**What breaks:** `.topbarBtn { width: 36px; height: 36px; }` — the hamburger button (opens sidebar drawer) and notification bell in the mobile top bar are both 36×36px, 8px below the minimum. The hamburger is the primary navigation control on mobile; a missed tap is a real friction point.  
**Fix:**
```css
.topbarBtn { width: 44px; height: 44px; }
```

---

### Sidebar close button — below 44px touch target

**Breakpoints affected:** ≤768px  
**Where:** [`frontend/components/AdminLayout.module.css:107`](frontend/components/AdminLayout.module.css#L107)  
**What breaks:** `.sidebarClose { padding: 4px; }` on an 18px icon — effective touch area is approximately 26px. When the sidebar drawer is open, this is the primary way to close it (alongside tapping the overlay); a small close button is a usability failure.  
**Fix:**
```css
.sidebarClose {
  padding: 0;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

### Admin filter inputs — below 44px height on touch

**Breakpoints affected:** ≤768px  
**Where:** [`frontend/app/admin/orders/page.module.css:37`](frontend/app/admin/orders/page.module.css#L37), [`frontend/app/admin/products/page.module.css`](frontend/app/admin/products/page.module.css) (same pattern)  
**What breaks:** `.filterSelect, .filterInput { height: 36px; }` — filter controls across orders, products, and customers pages are 36px tall on mobile. While admin is primarily desktop, the mobile layout is explicitly supported, and 36px inputs are noticeably small on a touchscreen.  
**Fix:** Add a single mobile override in each admin page module CSS:
```css
@media (max-width: 768px) {
  .filterSelect,
  .filterInput,
  .searchBtn,
  .clearBtn { height: 44px; }
}
```
This is the same fix in three places; lowest priority since admin on mobile is rare.

---

### Admin orders — expanded detail: 3-column grid not responsive

**Breakpoints affected:** ≤500px  
**Where:** [`frontend/app/admin/orders/page.module.css:229`](frontend/app/admin/orders/page.module.css#L229)  
**What breaks:** `.detailMeta { grid-template-columns: repeat(3, 1fr); }` — no responsive breakpoint. At 768px (the admin mobile width) the main content area is 768−48 = 720px, giving 240px per column (workable). Below 500px, columns shrink to ~150px and the customer name + email + address data word-wraps aggressively, making it unreadable.  
**Fix:**
```css
@media (max-width: 500px) {
  .detailMeta { grid-template-columns: 1fr; }
}
```

---

### Admin products table — horizontal scroll on tablet

**Breakpoints affected:** 768px  
**Where:** [`frontend/app/admin/products/page.module.css`](frontend/app/admin/products/page.module.css) `.tableWrap`  
**What breaks:** The products table has 8 columns with combined fixed widths (checkbox 40 + thumb 64 + status 120 + price 100 + stock 110 + updated 90 + actions 140 = 664px minimum, before the `auto` name column). At 768px mobile with 48px total padding, content width is 720px. The table would just fit, but the name column would be squeezed to ≈56px, truncating most product names.  
**[VISUAL-CHECK-NEEDED]** — test at 768px in devtools. The `tableWrap` has `overflow-x: auto` so the table won't break the layout, but if names are truncated to 2–3 characters, consider hiding the "Updated" column on ≤768px:
```css
@media (max-width: 768px) {
  .table colgroup col:nth-child(7),
  .table thead th:nth-child(7),
  .table tbody td:nth-child(7) { display: none; }
}
```

---

### Admin orders table — search input fixed width at 220px

**Breakpoints affected:** 320–480px  
**Where:** [`frontend/app/admin/orders/page.module.css:62`](frontend/app/admin/orders/page.module.css#L62)  
**What breaks:** `.searchWrap .filterInput { width: 220px; }` — this hardcoded width means the search field is 220px wide even on a 320px phone. With 16px padding on each side, the remaining content width is 288px, of which 220px is just the search input. The "Search" button beside it pushes the total search row to ~270px+ which may overflow or squeeze against other filter elements.  
**Fix:**
```css
@media (max-width: 600px) {
  .searchWrap { width: 100%; }
  .searchWrap .filterInput { width: 100%; flex: 1; }
}
```

---

### Admin layout — bulkBar sticky `top: 0` collides with mobile topbar

**Breakpoints affected:** ≤768px  
**Where:** [`frontend/app/admin/products/page.module.css:67`](frontend/app/admin/products/page.module.css#L67)  
**What breaks:** `.bulkBar { position: sticky; top: 0; z-index: 30; }`. On mobile, the topbar is `position: fixed; height: 56px; z-index: 400`. The sticky bulkBar at `top: 0` would slide under the topbar when it sticks. Since `z-index: 30 < z-index: 400`, the topbar covers the bulkBar. The bulk action buttons become inaccessible while the topbar is visible.  
**Fix:**
```css
@media (max-width: 768px) {
  .bulkBar { top: 56px; } /* clear the 56px mobile topbar */
}
```

---

### Responsive summary table (admin)

| ID | Component / File | Breakpoints | Type | Fix needed |
|----|-----------------|-------------|------|-----------|
| A-R1 | `AdminLayout.module.css:156` | ≤768px | Touch target (36px topbar btn) | Yes — `44px` |
| A-R2 | `AdminLayout.module.css:107` | ≤768px | Touch target (26px close btn) | Yes — `min-height: 44px` |
| A-R3 | `orders/page.module.css:37` | ≤768px | Touch target (36px filter inputs) | Yes — `height: 44px` mobile |
| A-R4 | `orders/page.module.css:229` | ≤500px | 3-col grid not responsive | Yes — `grid-template-columns: 1fr` |
| A-R5 | `products/page.module.css` | 768px | Table column squeeze | VISUAL-CHECK-NEEDED |
| A-R6 | `orders/page.module.css:62` | 320–480px | Fixed 220px search input | Yes — `width: 100%` on mobile |
| A-R7 | `products/page.module.css:67` | ≤768px | Sticky bulkBar under fixed topbar | Yes — `top: 56px` on mobile |
