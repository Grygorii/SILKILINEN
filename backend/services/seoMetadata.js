'use strict';

// One owner for writes to SEO metadata. The normal SEO Base editor and the
// manual-AI review flow both call this service, so they cannot drift on limits,
// record ownership, URL construction or IndexNow notification.
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const { getPageSeo, savePageSeo, EDITABLE_PATHS } = require('./pageSeo');
const { siteUrl } = require('../config/site');
const { pingIndexNow } = require('./indexNow');

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 165;
const MODELS = { product: Product, category: Category, collection: Collection };

function trimMeta(value, max) {
  return String(value || '').trim().slice(0, max);
}

function targetUrl(type, docOrId) {
  if (type === 'page') return siteUrl(String(docOrId));
  if (type === 'product') return siteUrl(`/product/${docOrId.slug || docOrId._id}`);
  if (type === 'category') return siteUrl(`/shop?category=${docOrId.slug}`);
  return siteUrl(`/collections/${docOrId.slug || docOrId._id}`);
}

async function readSeoTarget(type, id, { context = false } = {}) {
  if (type === 'page') {
    if (!EDITABLE_PATHS.includes(String(id))) return null;
    const current = getPageSeo(String(id)) || {};
    return {
      type, id: String(id), label: id === '/' ? 'Homepage' : String(id), url: targetUrl(type, id),
      metaTitle: current.metaTitle || '', metaDescription: current.metaDescription || '', updatedAt: null,
      context: context ? { kind: 'page', name: id === '/' ? 'Homepage' : String(id), description: '', items: [] } : undefined,
    };
  }

  const Model = MODELS[type];
  if (!Model) return null;
  const fields = type === 'product'
    ? 'name slug description category materialComposition colours price keywords metaTitle metaDescription status updatedAt'
    : 'name label slug description metaTitle metaDescription status updatedAt';
  const doc = await Model.findById(id).select(fields).lean();
  if (!doc) return null;
  if (type === 'product' && !['active', 'sold_out'].includes(doc.status)) return null;
  if (type === 'category' && doc.status !== 'active') return null;
  if (type === 'collection' && doc.status !== 'active') return null;

  const label = type === 'category' ? doc.label : doc.name;
  const out = {
    type, id: String(doc._id), label, url: targetUrl(type, doc),
    metaTitle: doc.metaTitle || '', metaDescription: doc.metaDescription || '', updatedAt: doc.updatedAt || null,
  };
  if (!context) return out;

  if (type === 'product') {
    out.context = {
      kind: 'product', name: doc.name, description: doc.description || '', category: doc.category || '',
      materialComposition: doc.materialComposition || '', colours: doc.colours || [], price: doc.price || null,
      keywords: doc.keywords || [],
    };
    return out;
  }

  const related = type === 'category'
    ? await Product.find({ category: doc.slug, status: 'active' }).select('name').limit(12).lean()
    : await Product.find({ collections: doc._id, status: 'active' }).select('name').limit(12).lean();
  out.context = { kind: type, name: label, description: doc.description || '', items: related.map(item => item.name) };
  return out;
}

async function saveSeoMeta({ type, id, metaTitle, metaDescription, source = 'seo-base' }) {
  const title = trimMeta(metaTitle, TITLE_MAX);
  const description = trimMeta(metaDescription, DESCRIPTION_MAX);
  if (type === 'page') {
    if (!EDITABLE_PATHS.includes(String(id))) throw new Error('Unknown page path');
    const saved = await savePageSeo(id, { metaTitle: title, metaDescription: description });
    pingIndexNow(targetUrl(type, id), { source }).catch(() => {});
    return { ok: true, metaTitle: saved.metaTitle, metaDescription: saved.metaDescription, url: targetUrl(type, id) };
  }
  const Model = MODELS[type];
  if (!Model) throw new Error('Unknown type');
  const doc = await Model.findByIdAndUpdate(id, { metaTitle: title, metaDescription: description }, { new: true, runValidators: true })
    .select('metaTitle metaDescription slug').lean();
  if (!doc) throw new Error('Not found');
  const url = targetUrl(type, { ...doc, _id: id });
  pingIndexNow(url, { source }).catch(() => {});
  return { ok: true, metaTitle: doc.metaTitle || '', metaDescription: doc.metaDescription || '', url };
}

module.exports = { TITLE_MAX, DESCRIPTION_MAX, readSeoTarget, saveSeoMeta };
