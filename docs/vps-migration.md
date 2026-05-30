# SILKILINEN → VPS migration runbook

**Target:** one Netherlands kVPS90 (8 GB RAM, 4 cores, 90 GB SSD) running **everything** — Next.js frontend, Express backend, and self-hosted MongoDB. Fully off Vercel + Railway + Atlas.

**Decisions locked (29 May 2026):** self-host Mongo · full move (FE+BE) · Netherlands DC.

**OS assumption:** Ubuntu 24.04 LTS (or 22.04). Commands assume that.

> ⚠️ This is a **live store with real Stripe payments**. Do NOT cancel Vercel / Railway / Atlas until you've run 2–3 clean days on the VPS. Keep them as instant rollback.

---

## The 5 code-level landmines (read first)

1. **Checkout uses a Mongo transaction** (`backend/routes/checkoutV2.js:445`). Transactions REQUIRE a replica set. A standalone `mongod` throws → customers pay, no order recorded. **Self-hosted Mongo must run as a single-node replica set** (Phase 3).
2. **Port collision** — Next.js and Express both default to 3000. Pin Express to `PORT=5000`.
3. **Cron double-fire** — cart recovery is an in-process `setInterval` (`server.js`). Run the backend as **1 PM2 instance (fork mode)**, never cluster, or it sends recovery emails N times.
4. **Hardcoded Railway fallback** in `backend/services/email.js` (newsletter-unsubscribe + cart-recovery links) → **must set `BACKEND_URL`** or emails link back to Railway.
5. **Vercel geo headers gone** — `/api/track/visit` reads `x-vercel-ip-country`; off Vercel it falls back to ipapi.co (still works). Optional: nginx GeoIP2 to restore free geo.

---

## Architecture on the box

```
            Internet (443)
                │
              nginx  ──TLS (Let's Encrypt)
            ┌───┴────────────────────────┐
 silkilinen.com / www            api.silkilinen.com
      │                                  │
  Next.js :3000 (PM2)            Express :5000 (PM2, 1 inst)
                                         │
                                  mongod 127.0.0.1:27017
                                  (single-node replica set rs0, auth on)
```

Keeping a **separate `api.` subdomain** for Express = the smallest code change (just env values) and avoids a Next-vs-Express `/api/*` route collision. Cloudinary / Stripe / Resend / DeepSeek / Gemini stay external — only env vars.

---

## Phase 0 — Prep (before touching the server)

- [ ] Buy kVPS90, **Netherlands** DC, Ubuntu 24.04. Note the **public IP**.
- [ ] Have ready: current Atlas connection string, ALL API keys (copy from Railway + Vercel dashboards), Stripe dashboard access, DNS/registrar access for silkilinen.com.
- [ ] **Lower DNS TTL** on `silkilinen.com`, `www`, and (new) `api` records to **300s** — do this ~24 h before cutover so the flip propagates fast.
- [ ] Generate an SSH keypair if you don't have one (`ssh-keygen -t ed25519`).

### Env var inventory

**Changes on the VPS:**
| Var | New value |
|---|---|
| `PORT` | `5000` |
| `MONGODB_URI` | `mongodb://silki:<pw>@127.0.0.1:27017/silkilinen?replicaSet=rs0&authSource=admin` |
| `BACKEND_URL` | `https://api.silkilinen.com` |
| `FRONTEND_URL` | `https://silkilinen.com` |
| `CORS_ORIGINS` | `https://silkilinen.com,https://www.silkilinen.com` |
| `STRIPE_WEBHOOK_SECRET` | the **new** endpoint's secret (Phase 7) |
| `NEXT_PUBLIC_API_URL` | `https://api.silkilinen.com` |
| `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` | unset / `false` |

**Copy unchanged from Railway/Vercel:**
`JWT_SECRET`, `JWT_CUSTOMER_SECRET`, `PREVIEW_TOKEN_SECRET`, `STRIPE_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`, `DEEPSEEK_API_KEY` (+ `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_SEO`), `GEMINI_API_KEY` (+ `GEMINI_MODEL`, `GEMINI_DAILY_LIMIT`), `FAL_KEY*` (if used), `GOOGLE_CLIENT_ID`, `INSTAGRAM_ACCESS_TOKEN`, `META_PIXEL_ID`, `META_CONVERSIONS_API_TOKEN`, `NODE_ENV=production`, `LOG_LEVEL`, `CSP_ENABLED`.

Frontend public (build-time): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_PINTEREST_TAG_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

> Google OAuth origins reference `silkilinen.com` (unchanged) → no action.

---

## Phase 1 — Harden the server

```bash
ssh root@<VPS_IP>
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your key in
# Edit /etc/ssh/sshd_config:  PermitRootLogin no   PasswordAuthentication no
systemctl restart ssh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
apt update && apt -y install fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
timedatectl set-timezone Europe/Dublin
```
Reconnect as `deploy@<VPS_IP>` from here on. (SWAP 4 GB is already provisioned on kVPS90.)

---

## Phase 2 — Install the stack

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs nginx git
sudo npm i -g pm2

# MongoDB 7
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-7.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-7.gpg] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-7.list
sudo apt update && sudo apt -y install mongodb-org

# Certbot
sudo apt -y install certbot python3-certbot-nginx
node -v && mongod --version && nginx -v
```

---

## Phase 3 — MongoDB as a single-node replica set (CRITICAL)

```bash
# /etc/mongod.conf — set:
#   net:   bindIp: 127.0.0.1          # localhost only
#   replication:
#     replSetName: rs0
sudo systemctl enable --now mongod
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
sleep 5 && mongosh --eval 'rs.status().myState'   # expect 1 (PRIMARY)
```

Enable auth:
```bash
mongosh <<'EOF'
use admin
db.createUser({user:"admin",pwd:"<STRONG_ADMIN_PW>",roles:["root"]})
use silkilinen
db.createUser({user:"silki",pwd:"<STRONG_APP_PW>",roles:[{role:"readWrite",db:"silkilinen"}]})
EOF
# /etc/mongod.conf — add:  security:\n  authorization: enabled
sudo systemctl restart mongod
```
Final `MONGODB_URI`: `mongodb://silki:<APP_PW>@127.0.0.1:27017/silkilinen?replicaSet=rs0&authSource=admin`
**The `replicaSet=rs0` param is mandatory** — it's what makes the driver allow transactions.

---

## Phase 4 — Migrate the data from Atlas

```bash
# From the VPS (Atlas allows any IP for a dump, or temporarily allowlist the VPS IP):
mongodump --uri="<ATLAS_SRV_URI>" --out=/home/deploy/atlas-dump
mongorestore --uri="mongodb://silki:<APP_PW>@127.0.0.1:27017/?replicaSet=rs0&authSource=admin" \
  --nsInclude='silkilinen.*' /home/deploy/atlas-dump
# Verify:
mongosh "<local-uri>" --eval 'db.products.countDocuments(); db.orders.countDocuments(); db.customers.countDocuments()'
```
Compare counts against Atlas. **You'll re-run a final delta sync at cutover** (Phase 9) to catch orders placed in between.

---

## Phase 5 — Deploy the code

```bash
sudo mkdir -p /var/www && sudo chown deploy:deploy /var/www
cd /var/www && git clone https://github.com/Grygorii/SILKILINEN.git silkilinen
cd silkilinen

# Backend
cd backend && npm ci --omit=dev
nano .env        # paste ALL backend vars (Phase 0 table) incl PORT=5000
cd ..

# Frontend — NEXT_PUBLIC_* must exist BEFORE build (they're inlined)
cd frontend && npm ci
nano .env.production   # NEXT_PUBLIC_API_URL=https://api.silkilinen.com etc.
npm run build
cd ..
```

`ecosystem.config.js` in repo root:
```js
module.exports = { apps: [
  { name: 'silkilinen-api', cwd: './backend', script: 'server.js', instances: 1, exec_mode: 'fork', env: { NODE_ENV: 'production' } },
  { name: 'silkilinen-web', cwd: './frontend', script: 'node_modules/next/dist/bin/next', args: 'start', instances: 1, exec_mode: 'fork', env: { NODE_ENV: 'production' } },
]}
```
```bash
pm2 start ecosystem.config.js && pm2 save && pm2 startup   # run the printed sudo line
pm2 logs   # confirm both up, "Connected to MongoDB", "Server running on port 5000"
```

---

## Phase 6 — nginx + TLS

`/etc/nginx/sites-available/silkilinen` (two server blocks):
```nginx
server {
  server_name silkilinen.com www.silkilinen.com;
  client_max_body_size 25m;                     # image uploads
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server {
  server_name api.silkilinen.com;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # real client IP → rate-limit + geo hash
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/silkilinen /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d silkilinen.com -d www.silkilinen.com -d api.silkilinen.com
# certbot adds http→https redirect + a renewal timer automatically
```
> `trust proxy` is already set in `server.js`, so the forwarded IP resolves correctly. The Stripe webhook raw body passes through nginx unmodified — no extra config.

---

## Phase 7 — Stripe webhook (do BEFORE cutover)

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint** → `https://api.silkilinen.com/api/webhook`, select the same events as the current Railway endpoint (`payment_intent.succeeded`, etc.).
2. Copy its **signing secret** → set `STRIPE_WEBHOOK_SECRET` in `backend/.env` → `pm2 restart silkilinen-api`.
3. **Leave the old Railway webhook active** through the transition. Both fire; the webhook's existing-order guard (`Order.findOne({ stripePaymentIntentId })`) makes it idempotent, so no double orders.

---

## Phase 8 — Test BEFORE flipping DNS

Point your laptop at the VPS without changing public DNS — add to your local `/etc/hosts`:
```
<VPS_IP>  silkilinen.com www.silkilinen.com api.silkilinen.com
```
Smoke test (the same list that caught the earlier 500s):
- [ ] Homepage, `/shop`, a product page, **a journal article** (`/journal/how-to-wash-silk`) — all 200
- [ ] `/admin` login works
- [ ] **Place a real Stripe order** (small amount) → confirm: order appears in VPS Mongo, confirmation email sends, order shows in `/admin/orders`. Then refund it.
- [ ] Cart-recovery cron logs after boot (`pm2 logs silkilinen-api`)
- [ ] A page view writes a `Visit` doc (geo may be null — that's the expected ipapi.co fallback)
Remove the `/etc/hosts` lines when done.

---

## Phase 9 — Cutover (low-traffic window, e.g. 03:00)

1. **Final Mongo delta sync** — re-run Phase 4 dump/restore (mongorestore without `--drop` will skip existing; for orders placed since the first sync, do `mongorestore --drop --nsInclude='silkilinen.orders'` etc., or briefly put the store in maintenance to freeze writes).
2. **Flip DNS** A records → VPS IP: `silkilinen.com`, `www`, `api`. (TTL already 300s.)
3. Watch `pm2 logs` + `tail -f /var/log/nginx/access.log`. Place one more test order.
4. **Keep Vercel + Railway + Atlas running 48–72 h** — if anything breaks, flip DNS back instantly.

---

## Phase 10 — Decommission (after 2–3 clean days)

- [ ] Confirm: real orders flowing, emails sending, **backups running** (below), zero errors in logs.
- [ ] Delete the old Railway Stripe webhook.
- [ ] Download a final Atlas backup, archive it offsite, THEN pause/cancel Atlas, Railway, Vercel.

---

## Ongoing ops (the part that's now YOUR job)

**Backups — non-negotiable for self-hosted Mongo + a live store:**
```bash
# /home/deploy/backup.sh  (chmod +x, cron daily at 04:00)
ts=$(date +%F)
mongodump --uri="<local-uri>" --gzip --archive=/home/deploy/backups/silki-$ts.gz
# offsite copy — pick one: rclone to Backblaze B2 / Cloudflare R2, or rsync to another host
rclone copy /home/deploy/backups/silki-$ts.gz b2:silki-backups/
find /home/deploy/backups -mtime +14 -delete
```
`crontab -e` → `0 4 * * * /home/deploy/backup.sh`. **Test a restore once** — an untested backup isn't a backup.

**Monitoring:** UptimeRobot (free) on `https://silkilinen.com` + a backend health URL. PM2 auto-restarts crashed processes (`pm2 startup` makes it boot-persistent). Add a disk-space alert (Mongo + Cloudinary-cached images grow).

**The reliability trade you accepted:** one box = single point of failure. Vercel/Railway/Atlas had redundancy + backups built in; now snapshots (enable the host's if offered) + the offsite Mongo backup are your only safety net. If the VPS dies, the store is down until you restore — practice the restore so that's 30 min, not a panic.

**Updates:** `unattended-upgrades` handles OS security patches. Periodically `npm` re-deploy (git pull → npm ci → npm run build → pm2 reload) and patch Node/Mongo minor versions.

---

## Rollback (if cutover goes wrong)

Flip the DNS A records back to the Vercel/Railway values. Because you kept them running and TTL is 300s, you're recovered in ~5 minutes. Investigate on the VPS with the public domain still on the old infra.
