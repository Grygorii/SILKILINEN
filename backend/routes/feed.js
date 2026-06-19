const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Public product feed in Google-namespace RSS 2.0 — the format Pinterest ingests
// daily via "Provide a URL link". Same format works for Google Merchant & Meta,
// so this one endpoint is the single auto-updating source of truth: edit a
// product in admin, and every channel picks it up on its next daily pull.

const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
const BRAND = 'SILKILINEN';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function clean(s, max = 5000) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function primaryImage(p) {
  const imgs = Array.isArray(p.images) ? p.images : [];
  const img = imgs.find(i => i.isPrimary && i.url) || imgs.find(i => i.url);
  const url = (img && img.url) || p.image || '';
  return url && !url.startsWith('http') ? `${SITE}${url}` : url;
}

router.get('/products.xml', async function(req, res) {
  try {
    const products = await Product.find({ status: 'active' })
      .select('name slug description metaDescription price compareAtPrice images image totalStock inStock category gender ageGroup materialComposition')
      .lean();

    const items = products.map(p => {
      const img = primaryImage(p);
      if (!img) return ''; // Pinterest requires an image — skip imageless products
      const inStock = p.inStock !== false && (p.totalStock == null || p.totalStock > 0);
      const desc = clean(p.description || p.metaDescription || p.name);
      const reg = Number(p.price) || 0;
      const cmp = Number(p.compareAtPrice) || 0;
      const onSale = cmp > reg && reg > 0; // compareAtPrice is the "was" price
      const priceLines = onSale
        ? `    <g:price>${cmp.toFixed(2)} EUR</g:price>\n    <g:sale_price>${reg.toFixed(2)} EUR</g:sale_price>`
        : `    <g:price>${reg.toFixed(2)} EUR</g:price>`;
      const extras = [
        p.gender ? `    <g:gender>${esc(p.gender)}</g:gender>` : '',
        p.ageGroup ? `    <g:age_group>${esc(p.ageGroup)}</g:age_group>` : '',
        p.category ? `    <g:product_type>${esc(clean(p.category, 100))}</g:product_type>` : '',
        p.materialComposition ? `    <g:material>${esc(clean(p.materialComposition, 200))}</g:material>` : '',
      ].filter(Boolean).join('\n');

      return `  <item>
    <g:id>${esc(p._id)}</g:id>
    <title>${esc(clean(p.name, 150))}</title>
    <description>${esc(desc)}</description>
    <link>${esc(`${SITE}/product/${p.slug || p._id}`)}</link>
    <g:image_link>${esc(img)}</g:image_link>
    <g:availability>${inStock ? 'in stock' : 'out of stock'}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>${BRAND}</g:brand>
${priceLines}
    <g:identifier_exists>no</g:identifier_exists>${extras ? '\n' + extras : ''}
  </item>`;
    }).filter(Boolean).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>SILKILINEN — Product Feed</title>
  <link>${SITE}</link>
  <description>Pure silk &amp; linen intimates.</description>
${items}
</channel>
</rss>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('[feed] error:', err.message);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>feed unavailable</error>');
  }
});

module.exports = router;
