const mongoose = require('mongoose');

const journalArticleSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  slug:         { type: String, unique: true, sparse: true, index: true },
  excerpt:      { type: String, default: '' },
  body:         { type: String, default: '' },       // Tiptap HTML

  heroImage: {
    url:     { type: String, default: '' },
    alt:     { type: String, default: '' },
    caption: { type: String, default: '' },
  },

  author:       { type: String, default: 'Sabreen' },

  status:       { type: String, enum: ['draft', 'preview', 'published'], default: 'draft', index: true },
  publishedAt:  { type: Date, default: null },
  scheduledFor: { type: Date, default: null },

  metaTitle:          { type: String, default: '' },
  metaDescription:    { type: String, default: '' },
  keywords:           [{ type: String }],

  readingTimeMinutes: { type: Number, default: null },
  viewCount:          { type: Number, default: 0 },
  lastEditedBy:       { type: String, default: '' },
}, { timestamps: true });

// Auto-generate slug from title (called before save when slug is missing)
journalArticleSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
  }
  // Auto-calculate reading time from HTML body word count
  if (this.body) {
    const words = this.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
    this.readingTimeMinutes = Math.max(1, Math.ceil(words / 230));
  }
  next();
});

module.exports = mongoose.model('JournalArticle', journalArticleSchema);
