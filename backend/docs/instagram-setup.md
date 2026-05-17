# Instagram Basic Display API — Setup Guide

## What this is

Instagram Basic Display API lets you display @silkilinen's own posts on the homepage.  
It does NOT require app review. It's free and designed for exactly this use case.

---

## One-time setup (do this once, ~20 minutes)

### 1. Create a Meta Developer app

1. Go to https://developers.facebook.com/
2. Sign in with Sabreen's or Гріша's Facebook account (must be linked to the Instagram account)
3. Click **My Apps → Create App**
4. Choose type **Consumer** (not Business)
5. Fill in app name (e.g. "SILKILINEN Website"), contact email, click Create

### 2. Add Instagram Basic Display product

1. Inside the new app, click **Add Product** in the left sidebar
2. Find **Instagram Basic Display** and click **Set Up**
3. Scroll down to **User Token Generator**

### 3. Add the Instagram account as a test user

1. Click **Add Instagram Test User**
2. Enter Sabreen's Instagram username: `silkilinen`
3. Sabreen must open her Instagram app → Settings → Apps and websites → Tester Invites → Accept

### 4. Generate the access token

1. Back in the Meta for Developers dashboard → Instagram Basic Display → User Token Generator
2. Click **Generate Token** next to the @silkilinen account
3. A browser popup will ask Sabreen to log in and grant permissions — approve it
4. Copy the token shown (it's a long string starting with `IGQVJ…` or `EAA…`)

### 5. Exchange for a long-lived token (expires in 60 days, not 1 hour)

Run in your terminal (replace `SHORT_LIVED_TOKEN` with the token from step 4):

```bash
curl "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&access_token=SHORT_LIVED_TOKEN"
```

- `YOUR_APP_ID` and `YOUR_APP_SECRET` are in the app dashboard under **Settings → Basic**
- The response contains a `access_token` that lasts 60 days

### 6. Add the token to Railway

1. Open Railway → SILKILINEN backend service → Variables
2. Add: `INSTAGRAM_ACCESS_TOKEN` = the long-lived token from step 5
3. Railway will redeploy automatically

The homepage Instagram section will now show real posts from @silkilinen.

---

## Token refresh (every 60 days)

### Option A — Manual (from admin panel)

1. Open `silkilinen.com/admin/content` → Instagram tab
2. Click **Refresh token now**
3. Done. Token is refreshed for another 60 days.

### Option B — Automated (recommended)

The backend auto-refreshes the token weekly via a background job.  
No action needed as long as the site is running.

**Note:** If the token expires (e.g. site was down for 60+ days), you'll need to repeat steps 4–6 above to get a fresh token — expired tokens cannot be refreshed, only replaced.

---

## Where things live in the code

| File | Purpose |
|------|---------|
| `backend/routes/instagram.js` | API route — fetches posts, refreshes token, status endpoint |
| `frontend/components/InstagramGrid.tsx` | Homepage grid component |
| `frontend/app/admin/content/page.tsx` | Admin Instagram tab with status panel |

## Environment variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `INSTAGRAM_ACCESS_TOKEN` | Railway (backend) | Long-lived Instagram API token |
| `NEXT_PUBLIC_META_PIXEL_ID` | Vercel (frontend) | Meta Pixel (separate from API) |

---

## Troubleshooting

**"No posts showing on homepage"**  
→ Check `INSTAGRAM_ACCESS_TOKEN` is set in Railway  
→ Check admin Content → Instagram tab for error message  
→ Token may have expired — refresh or replace it  

**"Token refresh failed"**  
→ If the token has been expired for a while, it can't be refreshed — get a new one from Meta Developer console  

**"I get a 400 error from Instagram"**  
→ The account may not have any posts, or the app may still be in Development mode with no accepted tester invite  
