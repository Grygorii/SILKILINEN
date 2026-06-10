# Search Console (OAuth) — setup guide

Connects the backend to Google Search Console so the admin dashboard shows live
search performance (clicks, impressions, top queries/pages) and sitemap indexing
counts.

We use **OAuth**, not a service account, because Search Console's "Add user"
screen rejects service-account emails on personal Gmail accounts (the "email not
found" error). With OAuth you click **Allow** once and the backend reads your
data from then on.

~10 minutes. You'll create an OAuth client, set 4 Railway vars, then click one
button in the admin.

---

## Part A — OAuth consent screen (one-time, if not already done)

1. Go to **https://console.cloud.google.com** → your `silkilinen` project.
2. **APIs & Services → Enabled APIs** → enable **Google Search Console API** if
   it isn't already.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name `SILKILINEN`, your email for support + developer contact → Save.
   - **Test users → Add users** → add the Google account that owns Search
     Console (e.g. `grisha.kinzerskyi@gmail.com`). (In "Testing" mode only test
     users can authorise — that's fine, it's just you.)

## Part B — OAuth client

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. Application type: **Web application**, name `silkilinen-backend`.
3. **Authorised redirect URIs → Add URI** — this must EXACTLY match your backend
   URL plus the callback path:

   ```
   https://<your-railway-backend-domain>/api/admin/google/search-console/callback
   ```

   Use the backend's public URL (the same origin your frontend calls for
   `/api/...`). Example: `https://api.silkilinen.com/api/admin/google/search-console/callback`.
4. **Create** → copy the **Client ID** and **Client secret**.

## Part C — Railway vars (backend service → Variables)

| Variable | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | the Client ID from Part B |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the Client secret from Part B |
| `BACKEND_PUBLIC_URL` | your backend origin, e.g. `https://api.silkilinen.com` (no trailing slash, no `/api`) |
| `GSC_SITE_URL` | `sc-domain:silkilinen.com` (Domain property) **or** `https://www.silkilinen.com/` (URL-prefix property) |

Optional: `ADMIN_URL` (defaults to `https://www.silkilinen.com/admin`) — where you
land after authorising.

Redeploy after saving.

> The `BACKEND_PUBLIC_URL` you set here and the redirect URI you registered in
> Part B must point to the same domain, or Google will reject the callback with
> a `redirect_uri_mismatch` error.

## Part D — Connect

1. Open **/admin** → the **Search performance** panel now shows a **Connect
   Search Console** button.
2. Click it → Google's consent screen → **Allow**.
3. You're redirected back to the dashboard and the panel fills with live data
   (clicks, impressions, top queries/pages, sitemap indexing).

---

## Notes

- Access is **read-only** (`webmasters.readonly`).
- The refresh token is stored server-side (in the `SystemState` collection). To
  revoke, click **disconnect** (or remove the app at
  https://myaccount.google.com/permissions) and delete the Railway vars.
- New sites take days to accumulate search data — an empty panel right after
  connecting is normal.
