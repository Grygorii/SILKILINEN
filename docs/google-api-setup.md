# Google API access — setup guide (Search Console + Merchant Center)

Goal: let the SILKILINEN backend read live data from Google Search Console
(indexing/coverage) and Merchant Center (per-product disapproval reasons) so
the admin dashboard shows the *real* search/feed truth instead of guessing.

You do this once. ~10–15 minutes of clicking. No code from you.

**Security:** the only secret here is a JSON key file. It goes into Railway as
an environment variable. **Never** paste it into chat, email, or commit it to
git. The backend reads it from the env var at runtime.

---

## Part A — Create the robot (service account) in Google Cloud

1. Go to **https://console.cloud.google.com** (sign in with the Google account
   that owns Search Console + Merchant Center).
2. Top bar → project dropdown → **New Project** → name it `silkilinen` → Create.
   (Or reuse an existing project.)
3. Enable the two APIs the backend will call. For each, search the name in the
   top search bar, open it, click **Enable**:
   - **Google Search Console API**
   - **Content API for Shopping** (this is the Merchant Center API)
4. Left menu → **APIs & Services → Credentials**.
5. **+ Create Credentials → Service account**.
   - Service account name: `silkilinen-bot`
   - Click **Create and continue** → skip the optional role steps → **Done**.
6. In the Credentials list, click the new `silkilinen-bot@…` service account →
   **Keys** tab → **Add key → Create new key → JSON → Create**.
   A `.json` file downloads. **This is the secret. Keep it safe.**
7. Copy the service account **email** — it looks like:
   `silkilinen-bot@silkilinen-xxxxx.iam.gserviceaccount.com`
   You'll paste this email into Search Console and Merchant Center next.

---

## Part B — Add the robot to Search Console

1. Go to **https://search.google.com/search-console**.
2. Make sure the `silkilinen.com` property is selected.
3. **Settings** (left menu) → **Users and permissions** → **Add user**.
4. Paste the robot email. Permission: **Full** → **Add**.
   (Read-only "Restricted" works for most data, but Full also enables the URL
   Inspection API, so use Full.)
5. Note which **property type** you have — I need this:
   - **Domain property** → I use `sc-domain:silkilinen.com`
   - **URL-prefix property** → I use `https://www.silkilinen.com/`

---

## Part C — Add the robot to Merchant Center

1. Go to **https://merchants.google.com**.
2. **Settings** (gear icon) → **Account access** (a.k.a. *People and access*).
3. **Add user** / **+ Add** → paste the robot email → access level **Standard**
   → send/confirm.
4. Note your **Merchant ID** — the number shown at the top-right of Merchant
   Center (e.g. `123456789`). I need this.

---

## Part D — Put the secret into Railway

1. Go to your Railway project → the **backend** service → **Variables**.
2. Add these variables:

   | Variable | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_KEY` | Paste the **entire contents** of the JSON key file from Part A step 6 |
   | `GSC_SITE_URL` | `sc-domain:silkilinen.com` *or* `https://www.silkilinen.com/` (from Part B step 5) |
   | `MERCHANT_ID` | The number from Part C step 4 |

3. Save → Railway redeploys automatically.

---

## What to send me when done

You do **not** send the JSON. Just confirm:

- ✅ Robot added to Search Console — and whether it's a **Domain** or
  **URL-prefix** property.
- ✅ Robot added to Merchant Center — and the **Merchant ID** number.
- ✅ The three Railway variables are set.

Then I wire up the backend code, and the dashboard's "SEO & Merchant health"
panel starts showing live indexing status and the exact reason any product is
disapproved — with fixes attached.

---

## Notes

- **Google Ads is separate and later.** The Ads API additionally needs a
  *developer token* that Google has to approve (can take days) and a different
  auth flow, so we'll tackle ads once Search Console + Merchant are live.
- Everything the robot can do is read-only reporting in our usage. You can
  remove its access at any time from the same screens in Parts B and C.
