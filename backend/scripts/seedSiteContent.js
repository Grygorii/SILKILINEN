require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SiteContent = require('../models/SiteContent');

const CONTENT = [
  // ── Banner ──────────────────────────────────────────
  { key: 'banner_message_1', type: 'text', section: 'banner', label: 'Banner Message 1', order: 1,
    value: 'Free shipping on orders over €150 to Ireland 🇮🇪' },
  { key: 'banner_message_2', type: 'text', section: 'banner', label: 'Banner Message 2', order: 2,
    value: 'New to Silkilinen? Use code <strong>SILK10</strong> for 10% off' },
  { key: 'banner_message_3', type: 'text', section: 'banner', label: 'Banner Message 3', order: 3,
    value: 'An Irish silk & linen brand, based in Donegal' },
  { key: 'banner_message_4', type: 'text', section: 'banner', label: 'Banner Message 4', order: 4,
    value: 'All silk is <strong>OEKO-TEX certified</strong> — gentle on skin' },

  // ── Homepage Hero ────────────────────────────────────
  { key: 'homepage_hero_image', type: 'image', section: 'homepage', label: 'Hero Image', order: 1, value: '/hero.png' },
  { key: 'homepage_hero_title', type: 'text', section: 'homepage', label: 'Hero Title', order: 2,
    value: 'Pure silk, pure comfort.' },
  { key: 'homepage_hero_subtitle', type: 'text', section: 'homepage', label: 'Hero Subtitle', order: 3,
    value: 'Pure silk & linen intimates' },
  { key: 'homepage_hero_cta', type: 'text', section: 'homepage', label: 'Hero Button Text', order: 4,
    value: 'Shop the collection' },

  // ── Homepage Story Section ───────────────────────────
  { key: 'homepage_story_image', type: 'image', section: 'homepage', label: 'Story Section Image', order: 5, value: '' },
  { key: 'homepage_story_title', type: 'text', section: 'homepage', label: 'Story Section Title', order: 6,
    value: 'Born in Donegal, worn across the world' },
  { key: 'homepage_story_text', type: 'richtext', section: 'homepage', label: 'Story Section Text', order: 7,
    value: 'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres. We source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nWe\'re an Irish brand based in Donegal, and we share a commitment to slow, considered work.' },

  // ── Category Tiles ───────────────────────────────────
  { key: 'category_tile_robes_image', type: 'image', section: 'categories', label: 'Robes — Image', order: 1, value: '' },
  { key: 'category_tile_robes_title', type: 'text', section: 'categories', label: 'Robes — Title', order: 2, value: 'Robes' },
  { key: 'category_tile_dresses_image', type: 'image', section: 'categories', label: 'Dresses — Image', order: 3, value: '' },
  { key: 'category_tile_dresses_title', type: 'text', section: 'categories', label: 'Dresses — Title', order: 4, value: 'Dresses' },
  { key: 'category_tile_shorts_image', type: 'image', section: 'categories', label: 'Shorts — Image', order: 5, value: '' },
  { key: 'category_tile_shorts_title', type: 'text', section: 'categories', label: 'Shorts — Title', order: 6, value: 'Shorts' },
  { key: 'category_tile_shirts_image', type: 'image', section: 'categories', label: 'Shirts — Image', order: 7, value: '' },
  { key: 'category_tile_shirts_title', type: 'text', section: 'categories', label: 'Shirts — Title', order: 8, value: 'Shirts' },
  { key: 'category_tile_scarves_image', type: 'image', section: 'categories', label: 'Scarves — Image', order: 9, value: '' },
  { key: 'category_tile_scarves_title', type: 'text', section: 'categories', label: 'Scarves — Title', order: 10, value: 'Scarves' },

  // ── About Page ───────────────────────────────────────
  { key: 'about_hero_image', type: 'image', section: 'about', label: 'About — Hero Image', order: 1, value: '' },
  { key: 'about_story_image_1', type: 'image', section: 'about', label: 'About — Story Image 1', order: 2, value: '' },
  { key: 'about_story_image_2', type: 'image', section: 'about', label: 'About — Story Image 2', order: 3, value: '' },
  { key: 'about_story_text', type: 'richtext', section: 'about', label: 'About — Story Text', order: 4,
    value: 'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres.\n\nWe source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nWe\'re an Irish brand based in Donegal, and we share a commitment to slow, considered work. We work in small batches, never rushing the process, so that what reaches you is exactly what we intended — something you\'ll reach for again and again.' },

  // ── Instagram Grid ───────────────────────────────────
  { key: 'instagram_image_1', type: 'image', section: 'instagram', label: 'Instagram Image 1', order: 1, value: '' },
  { key: 'instagram_image_2', type: 'image', section: 'instagram', label: 'Instagram Image 2', order: 2, value: '' },
  { key: 'instagram_image_3', type: 'image', section: 'instagram', label: 'Instagram Image 3', order: 3, value: '' },
  { key: 'instagram_image_4', type: 'image', section: 'instagram', label: 'Instagram Image 4', order: 4, value: '' },
  { key: 'instagram_image_5', type: 'image', section: 'instagram', label: 'Instagram Image 5', order: 5, value: '' },
  { key: 'instagram_image_6', type: 'image', section: 'instagram', label: 'Instagram Image 6', order: 6, value: '' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const item of CONTENT) {
    const exists = await SiteContent.findOne({ key: item.key });
    if (exists) {
      // Migrate: if this is the hero image and DB still has the empty placeholder, seed the CSS fallback
      if (item.key === 'homepage_hero_image' && !exists.value && item.value) {
        exists.value = item.value;
        await exists.save();
        console.log(`${item.key}: migrated empty value to default`);
      }
      skipped++;
    } else {
      await SiteContent.create(item);
      created++;
    }
  }

  console.log(`Done — ${created} created, ${skipped} already existed`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
