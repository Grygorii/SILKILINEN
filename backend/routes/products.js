const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { pickProductFields } = require('../utils/productFields');
const { upload } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { sendDropAHint } = require('../services/email');
const { lightRateLimit } = require('../middleware/rateLimits');

// In-memory multer for CSV import (no cloud upload)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are accepted'));
    }
  },
});

// ── CSV helpers ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitValues(str) {
  return str.split(/[,|]/).map(s => s.trim()).filter(Boolean);
}

function mapEtsy(row) {
  const tags = splitValues(row['TAGS'] || '');
  const price = parseFloat(row['PRICE'] || '0');
  let colours = [];
  let sizes = [];
  try {
    const vars = JSON.parse(row['VARIATIONS'] || '[]');
    for (const v of vars) {
      const name = (v.formattedName || '').toLowerCase();
      const values = (v.values || []).map(x => x.value).filter(Boolean);
      if (name.includes('color') || name.includes('colour')) colours = values;
      else if (name.includes('size')) sizes = values;
    }
  } catch { /* VARIATIONS not JSON — skip */ }
  return { name: row['TITLE'] || '', price: isNaN(price) ? 0 : price, description: row['DESCRIPTION'] || '', category: tags[0] || '', colours, sizes };
}

function mapWooCommerce(row) {
  const cats = splitValues(row['Categories'] || '');
  const price = parseFloat(row['Regular price'] || row['Sale price'] || '0');
  return {
    name: row['Name'] || '',
    price: isNaN(price) ? 0 : price,
    description: stripHtml(row['Description'] || row['Short description'] || ''),
    category: cats[0] || '',
    colours: splitValues(row['Attribute 1 value(s)'] || row['Attribute 1 values'] || ''),
    sizes: splitValues(row['Attribute 2 value(s)'] || row['Attribute 2 values'] || ''),
  };
}

function mapGeneric(row) {
  const price = parseFloat(row['price'] || '0');
  return {
    name: row['name'] || '',
    price: isNaN(price) ? 0 : price,
    description: row['description'] || '',
    category: row['category'] || '',
    colours: splitValues(row['colours'] || row['colors'] || ''),
    sizes: splitValues(row['sizes'] || ''),
  };
}

function csvToProducts(records, platform) {
  if (platform === 'shopify') {
    const products = new Map();
    let lastTitle = null;
    for (const row of records) {
      const title = row['Title'] || row['title'];
      if (title) {
        lastTitle = title;
        const price = parseFloat(row['Variant Price'] || row['Price'] || '0');
        products.set(title, {
          name: title,
          price: isNaN(price) ? 0 : price,
          description: stripHtml(row['Body (HTML)'] || ''),
          category: row['Type'] || row['Product Type'] || '',
          colourSet: new Set(),
          sizeSet: new Set(),
        });
      }
      if (lastTitle && products.has(lastTitle)) {
        const p = products.get(lastTitle);
        const opt1 = (row['Option1 Value'] || '').trim();
        const opt2 = (row['Option2 Value'] || '').trim();
        if (opt1 && opt1 !== 'Default Title') p.colourSet.add(opt1);
        if (opt2 && opt2 !== 'Default Title') p.sizeSet.add(opt2);
      }
    }
    return [...products.values()].map(({ colourSet, sizeSet, ...p }) => ({
      ...p, colours: [...colourSet], sizes: [...sizeSet],
    }));
  }

  const mapFn = platform === 'etsy' ? mapEtsy
    : platform === 'woocommerce' ? mapWooCommerce
      : mapGeneric;

  return records.map(mapFn).filter(p => p.name);
}

// ── Public filter — applied to every customer-facing product query ─────────────
// A product is only visible publicly if it is active, has at least one image
// with a real URL, and has a price > 0. `images.0: { $exists: true }` alone
// passes when the first image subdoc exists but its url is null/empty — that
// was leaking imageless products onto the homepage as cream placeholders.
// Require images.0.url to be a non-empty string so the public listings only
// show products that actually render.
const PUBLIC_FILTER = {
  status: 'active',
  'images.0.url': { $type: 'string', $ne: '' },
  price: { $gt: 0 },
};

// Fields the storefront must never receive — internal margin/cost data and the
// admin who last edited. Applied to every public product read.
const PUBLIC_PROJECTION = '-costPrice -costing -lastUpdatedBy';

// ── Routes ─────────────────────────────────────────────────────────────────────

// Attach storefront rating summary (approved reviews only) to a product list
// so cards can show stars without an extra request per card. One aggregation
// for the whole page, using the (productId, status) index.
async function attachRatings(products) {
  if (!products.length) return products;
  const ids = products.map(p => p._id);
  const ratings = await Review.aggregate([
    { $match: { productId: { $in: ids }, status: 'approved' } },
    { $group: { _id: '$productId', avg: { $avg: '$starRating' }, count: { $sum: 1 } } },
  ]);
  const byId = new Map(ratings.map(r => [String(r._id), r]));
  return products.map(p => {
    const obj = typeof p.toObject === 'function' ? p.toObject() : p;
    const r = byId.get(String(p._id));
    return { ...obj, ratingAverage: r ? Math.round(r.avg * 10) / 10 : 0, ratingCount: r ? r.count : 0 };
  });
}

// Hard ceiling on a single public product response. The list was previously
// unbounded — at thousands of products one call would ship the entire catalogue
// (full docs incl. image arrays) plus an aggregate over every id. This caps the
// worst case while staying invisible at the current catalogue size; callers that
// need more should page. `?slim=true` returns just the fields the sitemap needs.
const MAX_LIMIT = 1000;
const SLIM_PROJECTION = 'name price slug status updatedAt isNewArrival';

router.get('/', async function(req, res) {
  try {
    const { sort, limit, category, q, ids, isNew, slim } = req.query;
    const isSlim = slim === 'true';
    const filter = { ...PUBLIC_FILTER };

    // Batch lookup by IDs — used by wishlist to resolve stored product IDs
    if (ids) {
      const idArray = ids.split(',').map(s => s.trim()).filter(Boolean);
      filter._id = { $in: idArray };
      const products = await Product.find(filter).select(PUBLIC_PROJECTION).lean();
      return res.json(await attachRatings(products));
    }

    if (category) filter.category = String(category);
    // Storefront "New Arrivals" — admin-flagged products only.
    if (isNew === 'true') filter.isNewArrival = true;
    if (q) {
      // Coerce + escape: a query value can arrive as an object ({$ne:…}) or a
      // regex-special string; escaping prevents both operator injection and a
      // ReDoS via a crafted pattern against the unindexed description field.
      const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }
    let query = Product.find(filter).select(isSlim ? SLIM_PROJECTION : PUBLIC_PROJECTION).lean();
    if (sort === '-createdAt') query = query.sort({ createdAt: -1 });
    // Always bound the result: honour an explicit ?limit (capped), else apply
    // the safety ceiling so the response can never grow with the whole catalogue.
    const lim = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 0), MAX_LIMIT) : MAX_LIMIT;
    query = query.limit(lim);
    const products = await query;
    // The slim list (sitemap/feed-style consumers) doesn't need rating rollups.
    res.json(isSlim ? products : await attachRatings(products));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload', requireAuth, upload.single('image'), function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/import', requireAuth, csvUpload.single('csv'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });

    const platform = (req.body.platform || 'generic').toLowerCase();
    const text = req.file.buffer.toString('utf-8');
    const records = parseCSV(text);

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV is empty or could not be parsed' });
    }

    const products = csvToProducts(records, platform);
    const results = [];

    for (const product of products) {
      if (!product.name) {
        results.push({ name: '(unnamed)', status: 'skipped', reason: 'Missing name' });
        continue;
      }
      if (!product.price || product.price <= 0) {
        results.push({ name: product.name, status: 'skipped', reason: 'Missing or invalid price' });
        continue;
      }
      const exists = await Product.findOne({ name: product.name });
      if (exists) {
        results.push({ name: product.name, status: 'skipped', reason: 'Duplicate' });
        continue;
      }
      try {
        await Product.create(product);
        results.push({ name: product.name, status: 'imported' });
      } catch (err) {
        results.push({ name: product.name, status: 'error', reason: err.message });
      }
    }

    res.json({
      imported: results.filter(r => r.status === 'imported').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async function(req, res) {
  try {
    const product = await Product.create(pickProductFields(req.body));
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/drop-hint', lightRateLimit, async function(req, res) {
  try {
    const { recipientName, recipientEmail, senderName, message } = req.body;
    if (!recipientEmail || !senderName) {
      return res.status(400).json({ error: 'recipientEmail and senderName are required' });
    }
    const product = await Product.findOne({ ...PUBLIC_FILTER, _id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const primaryImg = product.images?.find(i => i.isPrimary) ?? product.images?.[0];
    const FRONTEND = process.env.FRONTEND_URL || 'https://silkilinen.com';

    await sendDropAHint({
      recipientName,
      recipientEmail,
      senderName,
      message,
      productName: product.name,
      productUrl: `${FRONTEND}/product/${product._id}`,
      productImage: primaryImg?.url || product.image || null,
      price: product.price,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/related/:id', async function(req, res) {
  try {
    const product = await Product.findOne({ ...PUBLIC_FILTER, _id: req.params.id }).select(PUBLIC_PROJECTION);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let related = await Product.find({
      ...PUBLIC_FILTER,
      _id: { $ne: product._id },
      category: product.category,
    }).select(PUBLIC_PROJECTION).limit(4);

    if (related.length < 4) {
      const ids = [product._id, ...related.map(p => p._id)];
      const extras = await Product.find({ ...PUBLIC_FILTER, _id: { $nin: ids } }).select(PUBLIC_PROJECTION).limit(4 - related.length);
      related = [...related, ...extras];
    }

    res.json(related);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id/preview?token=... — draft-visible product for signed preview links
router.get('/:id/preview', async function(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Preview token required' });

    const secret = process.env.PREVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(String(token), secret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired preview token' });
    }

    if (String(decoded.productId) !== req.params.id) {
      return res.status(403).json({ error: 'Token does not match product' });
    }

    const product = await Product.findById(req.params.id).select(PUBLIC_PROJECTION);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async function(req, res) {
  try {
    const product = await Product.findOne({ ...PUBLIC_FILTER, _id: req.params.id }).select(PUBLIC_PROJECTION);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, async function(req, res) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, pickProductFields(req.body), { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async function(req, res) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
