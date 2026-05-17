/**
 * Idempotent seed for social platform registry.
 * Run once: node backend/scripts/seedSocialPlatforms.js
 * Re-running is safe — uses upsert on `key`.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SocialPlatform = require('../models/SocialPlatform');

const PLATFORMS = [
  {
    key: 'instagram',
    displayName: 'Instagram',
    icon: 'instagram',
    brandColor: '#E1306C',
    baseUrl: 'https://instagram.com/',
    imageSpecs: [
      { aspectRatio: '1:1',  label: 'Square',    pixelWidth: 1080, pixelHeight: 1080, isDefault: true },
      { aspectRatio: '4:5',  label: 'Portrait',  pixelWidth: 1080, pixelHeight: 1350 },
      { aspectRatio: '9:16', label: 'Story/Reel', pixelWidth: 1080, pixelHeight: 1920 },
      { aspectRatio: '1.91:1', label: 'Landscape', pixelWidth: 1080, pixelHeight: 566 },
    ],
    captionMaxChars: 2200,
    captionRecommended: 125,
    hashtagsAllowed: true,
    hashtagsRecommended: 5,
    hashtagsMax: 30,
    supportsVideo: true,
    supportsCarousel: true,
    supportsAltText: true,
    tips: [
      'First 125 characters show without "more" — put the hook there.',
      'Mix 3–5 niche hashtags with 1–2 broad ones.',
      'Alt text improves accessibility and SEO reach.',
    ],
    sortOrder: 1,
  },
  {
    key: 'pinterest',
    displayName: 'Pinterest',
    icon: 'pinterest',
    brandColor: '#E60023',
    baseUrl: 'https://pinterest.com/',
    imageSpecs: [
      { aspectRatio: '2:3',  label: 'Standard Pin', pixelWidth: 1000, pixelHeight: 1500, isDefault: true },
      { aspectRatio: '1:1',  label: 'Square',        pixelWidth: 1000, pixelHeight: 1000 },
      { aspectRatio: '9:16', label: 'Long Pin',       pixelWidth: 1000, pixelHeight: 1778 },
    ],
    captionMaxChars: 500,
    captionRecommended: 100,
    hashtagsAllowed: true,
    hashtagsRecommended: 5,
    hashtagsMax: 20,
    supportsVideo: true,
    supportsCarousel: false,
    supportsAltText: true,
    tips: [
      '2:3 ratio (1000×1500) performs best in the feed.',
      'Include keywords naturally — Pinterest is a visual search engine.',
      'Add a clear CTA to your board description.',
    ],
    sortOrder: 2,
  },
  {
    key: 'facebook',
    displayName: 'Facebook',
    icon: 'facebook',
    brandColor: '#1877F2',
    baseUrl: 'https://facebook.com/',
    imageSpecs: [
      { aspectRatio: '1:1',    label: 'Square',    pixelWidth: 1080, pixelHeight: 1080, isDefault: true },
      { aspectRatio: '1.91:1', label: 'Landscape', pixelWidth: 1200, pixelHeight: 628 },
      { aspectRatio: '4:5',    label: 'Portrait',  pixelWidth: 1080, pixelHeight: 1350 },
    ],
    captionMaxChars: 63206,
    captionRecommended: 80,
    hashtagsAllowed: true,
    hashtagsRecommended: 3,
    hashtagsMax: 10,
    supportsVideo: true,
    supportsCarousel: true,
    supportsAltText: true,
    tips: [
      'Posts under 80 characters get ~66% higher engagement.',
      'Link posts auto-pull preview; image posts get more reach.',
      'Tag your Facebook Page if sharing from personal.',
    ],
    sortOrder: 3,
  },
  {
    key: 'tiktok',
    displayName: 'TikTok',
    icon: 'tiktok',
    brandColor: '#010101',
    baseUrl: 'https://tiktok.com/@',
    imageSpecs: [
      { aspectRatio: '9:16', label: 'Vertical video', pixelWidth: 1080, pixelHeight: 1920, isDefault: true },
      { aspectRatio: '1:1',  label: 'Square',          pixelWidth: 1080, pixelHeight: 1080 },
    ],
    captionMaxChars: 2200,
    captionRecommended: 150,
    hashtagsAllowed: true,
    hashtagsRecommended: 5,
    hashtagsMax: 0,
    supportsVideo: true,
    supportsCarousel: true,
    supportsAltText: false,
    tips: [
      'Hook in the first 3 seconds — critical.',
      'Trending audio dramatically increases reach.',
      'Use 3–5 relevant hashtags plus 1–2 trending ones.',
    ],
    sortOrder: 4,
  },
  {
    key: 'threads',
    displayName: 'Threads',
    icon: 'threads',
    brandColor: '#000000',
    baseUrl: 'https://threads.net/@',
    imageSpecs: [
      { aspectRatio: '1:1',  label: 'Square',   pixelWidth: 1080, pixelHeight: 1080, isDefault: true },
      { aspectRatio: '4:5',  label: 'Portrait', pixelWidth: 1080, pixelHeight: 1350 },
      { aspectRatio: '9:16', label: 'Vertical', pixelWidth: 1080, pixelHeight: 1920 },
    ],
    captionMaxChars: 500,
    captionRecommended: 300,
    hashtagsAllowed: false,
    hashtagsRecommended: 0,
    hashtagsMax: 0,
    supportsVideo: true,
    supportsCarousel: false,
    supportsAltText: true,
    tips: [
      'Hashtags are not supported on Threads.',
      'Conversational, authentic tone performs better than polished ads.',
      'Quote-replying to your own posts extends reach.',
    ],
    sortOrder: 5,
  },
  {
    key: 'youtube',
    displayName: 'YouTube',
    icon: 'youtube',
    brandColor: '#FF0000',
    baseUrl: 'https://youtube.com/@',
    imageSpecs: [
      { aspectRatio: '16:9', label: 'Thumbnail', pixelWidth: 1280, pixelHeight: 720, isDefault: true },
      { aspectRatio: '9:16', label: 'Short',      pixelWidth: 1080, pixelHeight: 1920 },
    ],
    captionMaxChars: 5000,
    captionRecommended: 200,
    hashtagsAllowed: true,
    hashtagsRecommended: 3,
    hashtagsMax: 15,
    supportsVideo: true,
    supportsCarousel: false,
    supportsAltText: false,
    tips: [
      'First 3 lines of description show without expansion — put key info there.',
      'Timestamps in description improve watch time.',
      'Custom thumbnail is the single biggest factor in click-through rate.',
    ],
    sortOrder: 6,
  },
  {
    key: 'twitter_x',
    displayName: 'Twitter / X',
    icon: 'twitter_x',
    brandColor: '#000000',
    baseUrl: 'https://x.com/',
    imageSpecs: [
      { aspectRatio: '16:9', label: 'Landscape', pixelWidth: 1200, pixelHeight: 675, isDefault: true },
      { aspectRatio: '1:1',  label: 'Square',    pixelWidth: 1080, pixelHeight: 1080 },
    ],
    captionMaxChars: 280,
    captionRecommended: 240,
    hashtagsAllowed: true,
    hashtagsRecommended: 1,
    hashtagsMax: 2,
    supportsVideo: true,
    supportsCarousel: false,
    supportsAltText: true,
    tips: [
      '280 character limit — every word must earn its place.',
      'One hashtag max for clean appearance; two if very relevant.',
      'Threads outperform single posts for storytelling.',
    ],
    sortOrder: 7,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const p of PLATFORMS) {
    const result = await SocialPlatform.findOneAndUpdate(
      { key: p.key },
      { $setOnInsert: p },
      { upsert: true, new: true }
    );
    console.log(`  ${result.isNew !== false ? 'inserted' : 'already exists'}: ${p.key}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
