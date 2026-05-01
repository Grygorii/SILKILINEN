const express = require('express');
const router = express.Router();
const multer = require('multer');
const Product = require('../models/product');
const { upload } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');

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

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get('/', async function(req, res) {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', requireAuth, upload.single('image'), function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async function(req, res) {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/related/:id', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
    }).limit(4);

    if (related.length < 4) {
      const ids = [product._id, ...related.map(p => p._id)];
      const extras = await Product.find({ _id: { $nin: ids } }).limit(4 - related.length);
      related = [...related, ...extras];
    }

    res.json(related);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async function(req, res) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
