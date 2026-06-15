require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set to a strong random value (>=32 chars).');
  process.exit(1);
}

if (!process.env.DEEPSEEK_API_KEY) {
  console.warn('[warning] DEEPSEEK_API_KEY not set — AI SEO generation will fail until it is configured.');
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const productRoutes = require('./routes/products');
const adminProductsRoutes = require('./routes/adminProducts');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const reviewsRoutes = require('./routes/reviews');
const adminReviewsRoutes = require('./routes/adminReviews');
const newsletterRoutes = require('./routes/newsletter');
const aiModelsRoutes = require('./routes/aiModels');
const aiPhotosRoutes = require('./routes/aiPhotos');
const customersRoutes = require('./routes/customers');
const promoCodesRoutes = require('./routes/promoCodes');
const contentRoutes = require('./routes/content');
const categoriesRoutes = require('./routes/categories');
const adminCategoriesRoutes = require('./routes/adminCategories');
const siteAuditRoutes = require('./routes/siteAudit');
const insightsRoutes = require('./routes/insights');
const adminHealthRoutes = require('./routes/adminHealth');
const adminSeoHealthRoutes = require('./routes/adminSeoHealth');
const adminAdvisorRoutes = require('./routes/adminAdvisor');
const adminGoogleOAuthRoutes = require('./routes/adminGoogleOAuth');
const trackRoutes = require('./routes/track');
const adminDashboardRoutes = require('./routes/adminDashboard');
const collectionsRoutes = require('./routes/collections');
const adminCollectionsRoutes = require('./routes/adminCollections');
const bundlesRoutes = require('./routes/bundles');
const adminBundlesRoutes = require('./routes/adminBundles');
const cartRoutes = require('./routes/cart');
const { checkoutRouter, webhookRouter } = require('./routes/checkoutV2');
const { router: campaignsRouter } = require('./routes/campaigns');
const marketingDashboardRouter = require('./routes/marketingDashboard');
const adminCustomersRouter = require('./routes/adminCustomers');
const journalRouter = require('./routes/journal');
const adminJournalRouter = require('./routes/adminJournal');
const instagramRouter = require('./routes/instagram');
const adminFinanceRouter = require('./routes/adminFinance');
const adminSocialRouter = require('./routes/adminSocial');
const socialRouter = require('./routes/social');
const adminSocialAssetsRouter = require('./routes/adminSocialAssets');
const adminShippingRouter = require('./routes/adminShipping');
const adminMaintenanceRouter = require('./routes/adminMaintenance');
const adminAnalystRouter = require('./routes/adminAnalyst');
const adminTodayRouter = require('./routes/adminToday');
const adminSearchRouter = require('./routes/adminSearch');
const adminGrowthRouter = require('./routes/adminGrowth');
const { runGrowthEngine } = require('./services/growthEngine');
const { runChiefIfDue } = require('./services/chiefOfStaff');
const { loadShippingOverrides } = require('./services/shipping');
const cartRecoveryRouter = require('./routes/cartRecovery');
const { processCartRecovery } = require('./services/cartRecovery');
const { runAdvisorDigest } = require('./services/advisorDigest');
const { processReviewRequests } = require('./services/reviewRequests');

const app = express();

// Trust Railway's reverse proxy so express-rate-limit can read X-Forwarded-For.
// Integer 1 = trust exactly one proxy hop; avoids IP spoofing via forged headers.
app.set('trust proxy', 1);

app.use(helmet({
  // Stronger HSTS — Lighthouse Best-Practices flagged the default as weak.
  // 2-year max-age + includeSubDomains + preload is the level Google's
  // HSTS preload list and the Lighthouse audit both want to see.
  strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
  // The default helmet CSP is overly strict for an API; the frontend
  // serves the storefront HTML, so the API doesn't need its own CSP.
  contentSecurityPolicy: false,
  // Don't isolate cross-origin requests — Stripe + Cloudinary + Gemini
  // all need to talk to this API, and the frontend lives on a different
  // origin. CORS already handles the real boundary.
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Request-scoped structured logging. Every request gets a unique id and a
// JSON log line on completion with method/path/status/duration. Inside
// handlers, req.log.{info,warn,error}() attaches the request id. Existing
// console.log calls in routes are left untouched — they will surface as
// regular lines in stdout and can be migrated incrementally.
app.use(pinoHttp({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Skip the noisy /health endpoint and serverless cold-start probes.
  autoLogging: {
    ignore: req => req.url === '/' || req.url === '/api/admin/health',
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[redacted]',
  },
}));

console.log('[boot] routes: admin/health, admin/dashboard, admin/site-audit, admin/insights, track');

// Production origins should come from CORS_ORIGINS (comma-separated).
// Localhost is allowed unconditionally only in non-production so dev keeps
// working. FRONTEND_URL is honoured for backwards-compat.
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const devOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:3000', 'http://localhost:3001'];
const ALLOWED_ORIGINS = [
  ...devOrigins,
  ...envOrigins,
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  console.error('FATAL: CORS_ORIGINS or FRONTEND_URL must be set in production.');
  process.exit(1);
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g. curl, Stripe webhooks, same-origin)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  // Permit the CSRF header on preflight responses.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
}));
app.use(cookieParser());

// Webhook must be before express.json() — Stripe needs the raw request body
app.use('/api/webhook', webhookRouter);

app.use(express.json());

// Strip Mongo operator/dotted keys from every JSON body — neutralises the
// NoSQL operator-injection class (e.g. {"token":{"$gt":""}}) before it reaches
// any query. Runs right after the body is parsed, before any route.
app.use(require('./middleware/sanitize').sanitizeBody);

// CSRF defence: require a custom header on every write. See middleware/csrf.js.
const { csrf } = require('./middleware/csrf');
app.use(csrf);
app.use('/api/v2/checkout', checkoutRouter);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/admin/reviews', adminReviewsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai-models', aiModelsRoutes);
app.use('/api/ai-photos', aiPhotosRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/site-audit', siteAuditRoutes);
app.use('/api/admin/insights', insightsRoutes);
app.use('/api/admin/health', adminHealthRoutes);
app.use('/api/admin/seo-health', adminSeoHealthRoutes);
app.use('/api/admin/advisor', adminAdvisorRoutes);
app.use('/api/admin/google/search-console', adminGoogleOAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/admin/collections', adminCollectionsRoutes);
app.use('/api/bundles', bundlesRoutes);
app.use('/api/admin/bundles', adminBundlesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/admin/campaigns', campaignsRouter);
app.use('/api/admin/marketing', marketingDashboardRouter);
app.use('/api/admin/customers', adminCustomersRouter);
app.use('/api/journal', journalRouter);
app.use('/api/admin/journal', adminJournalRouter);
app.use('/api/instagram', instagramRouter);
app.use('/api/admin/finance', adminFinanceRouter);
app.use('/api/admin/social', adminSocialRouter);
app.use('/api/social', socialRouter);
app.use('/api/admin/social-assets', adminSocialAssetsRouter);
app.use('/api/admin/shipping-rates', adminShippingRouter);
app.use('/api/admin/maintenance', adminMaintenanceRouter);
app.use('/api/admin/analyst', adminAnalystRouter);
app.use('/api/admin/today', adminTodayRouter);
app.use('/api/admin/search', adminSearchRouter);
app.use('/api/admin/growth', adminGrowthRouter);
app.use('/api/cart-recovery', cartRecoveryRouter);

mongoose.connect(process.env.MONGODB_URI)
  .then(function() {
    console.log('Connected to MongoDB');
    // Pull admin-edited shipping-rate overrides into the in-memory cache so
    // checkout reads stay synchronous. Non-fatal — defaults apply if it fails.
    loadShippingOverrides();
    require('./services/siteSettings').loadSiteSettings();
  })
  .catch(function(err) {
    // Fail fast: don't accept traffic with no database (would just 500).
    console.error('FATAL: MongoDB connection error:', err);
    process.exit(1);
  });

app.get('/', function(req, res) {
  res.send('Silkilinen backend is running');
});

// Multer errors arrive through next(err) during multipart parsing, so the
// route handler's try/catch never sees them. Map the common ones to clear
// 413/400 responses so the admin UI can show a useful toast instead of
// the generic "Internal server error" the backstop would otherwise emit.
const MULTER_MAX_MB = 25;
// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
  if (err && err.name === 'MulterError') {
    const map = {
      LIMIT_FILE_SIZE:      { status: 413, msg: `File too large. Max ${MULTER_MAX_MB} MB per image — re-export at a smaller size and try again.` },
      LIMIT_FILE_COUNT:     { status: 413, msg: 'Too many files at once. Upload in smaller batches.' },
      LIMIT_UNEXPECTED_FILE:{ status: 400, msg: `Unexpected field "${err.field}". Use the upload form.` },
      LIMIT_PART_COUNT:     { status: 413, msg: 'Too many parts in upload.' },
    };
    const out = map[err.code] || { status: 400, msg: `Upload rejected: ${err.message}` };
    return res.status(out.status).json({ error: out.msg });
  }
  next(err);
});

// Backstop error middleware. Existing route handlers still have their own
// try/catch blocks with bespoke status codes — this catches anything they
// miss (uncaught throws, sync errors, future routes that forget try/catch)
// and prevents stack traces leaking through Express's default handler.
// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
  const log = req.log || console;
  log.error({ err, path: req.path, method: req.method }, 'unhandled');
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3000;

let cartRecoveryStartTimeout = null;
let cartRecoveryInterval = null;
let advisorDigestStartTimeout = null;
let advisorDigestInterval = null;
let reviewRequestsStartTimeout = null;
let reviewRequestsInterval = null;
let growthEngineStartTimeout = null;
let growthEngineInterval = null;
let chiefStartTimeout = null;
let chiefInterval = null;

const server = app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);

  // Cart recovery cron — runs every hour. First run after 5 min to allow DB to settle.
  cartRecoveryStartTimeout = setTimeout(function() {
    processCartRecovery();
    cartRecoveryInterval = setInterval(processCartRecovery, 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  // Advisor digest — checks daily, but runAdvisorDigest only actually emails
  // once every 7 days (cadence enforced via SystemState, so restarts can't
  // skip or double-send). First check 10 min after boot. No-op until
  // RESEND_API_KEY + ADMIN_EMAIL are set.
  advisorDigestStartTimeout = setTimeout(function() {
    runAdvisorDigest().catch(err => console.error('[advisor-digest]', err));
    advisorDigestInterval = setInterval(
      () => runAdvisorDigest().catch(err => console.error('[advisor-digest]', err)),
      24 * 60 * 60 * 1000
    );
  }, 10 * 60 * 1000);

  // Review-request emails — runs daily, sending to buyers whose order is ≥14
  // days old and hasn't had one yet. Idempotent (Order.reviewRequestSentAt),
  // so daily is safe. First run 15 min after boot. No-op until RESEND_API_KEY
  // is set. This is what fills the empty product reviews over time.
  reviewRequestsStartTimeout = setTimeout(function() {
    const run = () => processReviewRequests({ send: true })
      .then(r => { if (r.sent) console.log(`[review-requests] sent ${r.sent} of ${r.eligible} eligible`); })
      .catch(err => console.error('[review-requests]', err));
    run();
    reviewRequestsInterval = setInterval(run, 24 * 60 * 60 * 1000);
  }, 15 * 60 * 1000);

  // Growth Engine — the autonomous marketing pulse. Checks every 6h which
  // specialist agents (content writer, social drafter, newsletter, watchdog)
  // are due per their own cadence and runs only those; everything public is
  // created as a draft for founder approval. First pulse 20 min after boot.
  growthEngineStartTimeout = setTimeout(function() {
    const pulse = () => runGrowthEngine()
      .then(r => { if (r.ran.length) console.log(`[growth] pulsed: ${r.ran.join(', ')} (${r.actionCount} actions)`); })
      .catch(err => console.error('[growth]', err));
    pulse();
    growthEngineInterval = setInterval(pulse, 6 * 60 * 60 * 1000);
  }, 20 * 60 * 1000);

  // Chief of Staff — the brain. Checks every 6h but only writes a new weekly
  // co-CEO brief when 7 days have passed (runChiefIfDue guards the cadence).
  // First check 25 min after boot, just after the engine's first pulse so the
  // brief can reflect fresh agent activity.
  chiefStartTimeout = setTimeout(function() {
    const think = () => runChiefIfDue()
      .then(r => { if (r.ran) console.log('[chief] weekly brief written'); })
      .catch(err => console.error('[chief]', err));
    think();
    chiefInterval = setInterval(think, 6 * 60 * 60 * 1000);
  }, 25 * 60 * 1000);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, draining...`);

  if (cartRecoveryStartTimeout) clearTimeout(cartRecoveryStartTimeout);
  if (cartRecoveryInterval) clearInterval(cartRecoveryInterval);
  if (advisorDigestStartTimeout) clearTimeout(advisorDigestStartTimeout);
  if (advisorDigestInterval) clearInterval(advisorDigestInterval);
  if (reviewRequestsStartTimeout) clearTimeout(reviewRequestsStartTimeout);
  if (reviewRequestsInterval) clearInterval(reviewRequestsInterval);
  if (growthEngineStartTimeout) clearTimeout(growthEngineStartTimeout);
  if (growthEngineInterval) clearInterval(growthEngineInterval);
  if (chiefStartTimeout) clearTimeout(chiefStartTimeout);
  if (chiefInterval) clearInterval(chiefInterval);

  // Hard exit if graceful drain stalls (e.g. hung Mongo or stuck request).
  const hardExit = setTimeout(() => {
    console.error('[shutdown] graceful drain timed out, forcing exit');
    process.exit(1);
  }, 10000);
  hardExit.unref();

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('[shutdown] clean exit');
      process.exit(0);
    } catch (err) {
      console.error('[shutdown] error closing mongo:', err.message);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
