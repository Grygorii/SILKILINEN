'use strict';

// Shared live-catalogue source rules for the Translation tab and the Manual AI
// hand-off. Keeping this here prevents their coverage counts and their source
// snapshots from drifting apart.
const Translation = require('../models/Translation');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');

const RESOURCE_CONFIG = {
  product: {
    Model: Product,
    query: { status: { $in: ['active', 'sold_out'] } },
    fields: ['name', 'description', 'metaTitle', 'metaDescription'],
    label: 'name',
    url: doc => `/product/${doc.slug || doc._id}`,
  },
  category: {
    Model: Category,
    query: { status: 'active' },
    fields: ['label', 'description', 'metaTitle', 'metaDescription'],
    label: 'label',
    url: doc => `/shop?category=${doc.slug || doc._id}`,
  },
  collection: {
    Model: Collection,
    query: { status: 'active' },
    fields: ['name', 'description', 'metaTitle', 'metaDescription'],
    label: 'name',
    url: doc => `/collections/${doc.slug || doc._id}`,
  },
};

function requiredFields(doc, fields) {
  return fields.filter(field => typeof doc[field] === 'string' && doc[field].trim());
}

function sourceFields(doc, fields) {
  return Object.fromEntries(requiredFields(doc, fields).map(field => [field, String(doc[field]).trim()]));
}

async function listLiveTranslationResources() {
  const entries = await Promise.all(Object.entries(RESOURCE_CONFIG).map(async ([type, config]) => {
    const docs = await config.Model.find(config.query)
      .select([...config.fields, 'slug'].join(' ')).lean();
    return docs.map(doc => ({
      type,
      id: String(doc._id),
      label: String(doc[config.label] || doc._id),
      detail: `${Object.keys(sourceFields(doc, config.fields)).length} source fields`,
    }));
  }));
  return entries.flat();
}

async function readTranslationResource(type, id, locale) {
  const config = RESOURCE_CONFIG[type];
  if (!config) return null;
  const doc = await config.Model.findOne({ _id: id, ...config.query })
    .select([...config.fields, 'slug', 'updatedAt'].join(' ')).lean();
  if (!doc) return null;
  const existing = await Translation.findOne({ resourceType: type, resourceId: String(id), locale }).lean();
  return {
    type,
    id: String(doc._id),
    label: String(doc[config.label] || doc._id),
    url: config.url(doc),
    fields: sourceFields(doc, config.fields),
    updatedAt: doc.updatedAt || null,
    translation: existing ? {
      fields: existing.fields || {},
      source: existing.source || '',
      updatedAt: existing.updatedAt || null,
    } : null,
  };
}

module.exports = { RESOURCE_CONFIG, requiredFields, sourceFields, listLiveTranslationResources, readTranslationResource };
