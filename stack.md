# SILKILINEN — Stack

## Frontend
- **Framework:** Next.js (App Router) on Vercel
- **Domains:** `silkilinen.com` + `www.silkilinen.com`
- **State:** React Context (CartContext, CustomerContext, CookieConsentContext, ProductSelectionContext, WishlistContext)
- **Styling:** CSS Modules, no Tailwind
- **Icons:** `lucide-react` (outline, `strokeWidth={1.5}` is the house style)

## Backend
- **Framework:** Express on Railway
- **URL:** `https://silkilinen-production.up.railway.app`
- **Node:** 20+ pinned via `package.json` engines and `backend/.nvmrc`
- **Builder:** Nixpacks forced via `backend/railway.toml` (workaround for Railway Railpack BuildKit bug — remove once Railway fixes it)
- **Reverse proxy:** `app.set('trust proxy', 1)` set in Express so rate limiter reads real client IP

## Database
- **MongoDB Atlas** via Mongoose
- Connection string in `MONGODB_URI` env var

## Image hosting
- **Cloudinary**, cloud name `dzybw5t5z`
- Upload endpoint goes through `upload_stream` wrapped in a Promise (`uploadBuffer`), `result.secure_url` is what's stored
- **Hard rule:** only `res.cloudinary.com` URLs are accepted server-side. Gemini chat URLs and other ad-hoc URLs are rejected at the API layer

## Payments
- **Stripe** (Payment Intents API, embedded Elements) — **LIVE mode**, transacting real EUR since 16 May 2026
- Webhook at `POST /api/webhook` consuming `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.succeeded`
- Webhook secret: `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is needed on Vercel only (do not set on Railway)
- Refund path verified by code review (`POST /api/orders/:id/refund` creates Stripe refund, updates `refunds[]`, sets status). Not yet tested with a real card refund — do it on the second real order

## Email
- **Resend** — send-only API key
- Health check uses configuration validation (do NOT call live API — the send-only key cannot list domains)
- Welcome emails, magic-link sign-in, order confirmation, status changes, cart recovery (3-email sequence), Drop a Hint
- RFC 8058 `List-Unsubscribe` header on cart recovery emails

## Auth
- **Customers:** magic-link via email + Google OAuth
- **Admin:** JWT (HS256), middleware at `backend/middleware/auth.js`
- Signed-token preview URLs for draft products and journal articles (1hr JWT, separate purpose types)

## AI
- **Image gen:** Gemini, 5 model identities (Aoife, Charlotte, Sofia, Maya, Yuki) using v2 prompts (separate `productShotPromptTemplate` and `lifestyleShotPromptTemplate` per model)
- **Text gen (SEO):** DeepSeek (`deepseek-chat`) via OpenAI SDK; abstraction layer at `backend/services/aiText.js`. Gemini text removed.

## Analytics & marketing pixels
- All gated behind cookie consent (`silkilinen:cookieConsent` localStorage key)
- GA4, Microsoft Clarity, Vercel Analytics, Meta Pixel, Pinterest Tag
- Meta Conversions API (server-side, deduplicated with frontend pixel via `event_id = 'order-${orderNumber}'`)

## Required env vars
**Backend (Railway):**
`MONGODB_URI`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CLOUDINARY_*`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_CLIENT_ID` (must be set or OAuth fails open — see gotchas), `META_PIXEL_ID`, `META_CONVERSIONS_API_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `BACKEND_URL`, `FRONTEND_URL`

**Frontend (Vercel):**
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_PINTEREST_TAG_ID`, `NEXT_PUBLIC_API_URL`
