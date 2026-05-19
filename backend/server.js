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
const productRoutes = require('./routes/products');
const adminProductsRoutes = require('./routes/adminProducts');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const reviewsRoutes = require('./routes/reviews');
const newsletterRoutes = require('./routes/newsletter');
const aiModelsRoutes = require('./routes/aiModels');
const aiPhotosRoutes = require('./routes/aiPhotos');
const customersRoutes = require('./routes/customers');
const promoCodesRoutes = require('./routes/promoCodes');
const contentRoutes = require('./routes/content');
const categoriesRoutes = require('./routes/categories');
const siteAuditRoutes = require('./routes/siteAudit');
const insightsRoutes = require('./routes/insights');
const adminHealthRoutes = require('./routes/adminHealth');
const trackRoutes = require('./routes/track');
const adminDashboardRoutes = require('./routes/adminDashboard');
const collectionsRoutes = require('./routes/collections');
const adminCollectionsRoutes = require('./routes/adminCollections');
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
const cartRecoveryRouter = require('./routes/cartRecovery');
const { processCartRecovery } = require('./services/cartRecovery');

const app = express();

// Trust Railway's reverse proxy so express-rate-limit can read X-Forwarded-For.
// Integer 1 = trust exactly one proxy hop; avoids IP spoofing via forged headers.
app.set('trust proxy', 1);

app.use(helmet());

console.log('[boot] routes: admin/health, admin/dashboard, admin/site-audit, admin/insights, track');

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://silkilinen.com',
  'https://www.silkilinen.com',
  'https://silkilinen.vercel.app',
  'https://silkilinen-git-master-grishakinzerskyi-1780s-projects.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g. curl, Stripe webhooks, same-origin)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());

// Webhook must be before express.json() — Stripe needs the raw request body
app.use('/api/webhook', webhookRouter);

app.use(express.json());
app.use('/api/v2/checkout', checkoutRouter);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai-models', aiModelsRoutes);
app.use('/api/ai-photos', aiPhotosRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin/site-audit', siteAuditRoutes);
app.use('/api/admin/insights', insightsRoutes);
app.use('/api/admin/health', adminHealthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/admin/collections', adminCollectionsRoutes);
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
app.use('/api/cart-recovery', cartRecoveryRouter);

mongoose.connect(process.env.MONGODB_URI)
  .then(function() { console.log('Connected to MongoDB'); })
  .catch(function(err) { console.error('MongoDB connection error:', err); });

app.get('/', function(req, res) {
  res.send('Silkilinen backend is running');
});

const PORT = process.env.PORT || 3000;

let cartRecoveryStartTimeout = null;
let cartRecoveryInterval = null;

const server = app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);

  // Cart recovery cron — runs every hour. First run after 5 min to allow DB to settle.
  cartRecoveryStartTimeout = setTimeout(function() {
    processCartRecovery();
    cartRecoveryInterval = setInterval(processCartRecovery, 60 * 60 * 1000);
  }, 5 * 60 * 1000);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, draining...`);

  if (cartRecoveryStartTimeout) clearTimeout(cartRecoveryStartTimeout);
  if (cartRecoveryInterval) clearInterval(cartRecoveryInterval);

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
