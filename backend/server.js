require('dotenv').config();

const DEFAULT_SECRET = 'silkilinen_super_secret_key_change_this_in_production';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set or is using the insecure default. Set a strong random secret in Railway environment variables.');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const productRoutes = require('./routes/products');
const adminProductsRoutes = require('./routes/adminProducts');
const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const reviewsRoutes = require('./routes/reviews');
const newsletterRoutes = require('./routes/newsletter');
const aiModelsRoutes = require('./routes/aiModels');
const aiPhotosRoutes = require('./routes/aiPhotos');
const customersRoutes = require('./routes/customers');
const promoCodesRoutes = require('./routes/promoCodes');
const contentRoutes = require('./routes/content');
const siteAuditRoutes = require('./routes/siteAudit');

const app = express();

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

// Webhook must be mounted before express.json() — Stripe needs the raw request body
// to verify the STRIPE_WEBHOOK_SECRET signature.
app.use('/api/webhook', webhookRoutes);

app.use(express.json());
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai-models', aiModelsRoutes);
app.use('/api/ai-photos', aiPhotosRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/promo-codes', promoCodesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin/site-audit', siteAuditRoutes);

mongoose.connect(process.env.MONGODB_URI)
  .then(function() { console.log('Connected to MongoDB'); })
  .catch(function(err) { console.error('MongoDB connection error:', err); });

app.get('/', function(req, res) {
  res.send('Silkilinen backend is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
