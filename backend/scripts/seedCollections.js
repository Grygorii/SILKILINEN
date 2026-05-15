require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Collection = require('../models/Collection');

const COLLECTIONS = [
  {
    name: 'New Arrivals',
    slug: 'new-arrivals',
    description: 'The latest additions to the SILKILINEN collection — fresh silk and linen pieces, just landed.',
    isFeatured: true,
    featuredOrder: 1,
    displayOrder: 1,
    status: 'active',
  },
  {
    name: 'Sleepwear',
    slug: 'sleepwear',
    description: 'Silk and linen sleepwear designed for deep rest. Breathable, natural, and effortlessly beautiful.',
    isFeatured: true,
    featuredOrder: 2,
    displayOrder: 2,
    status: 'active',
  },
  {
    name: 'Intimates',
    slug: 'intimates',
    description: 'Pure silk intimates crafted for comfort and confidence. Gentle on skin, lasting in quality.',
    isFeatured: true,
    featuredOrder: 3,
    displayOrder: 3,
    status: 'active',
  },
  {
    name: 'Donegal Motif Series',
    slug: 'donegal-motif-series',
    description: 'A curated series inspired by the landscapes and heritage of Donegal — woven into every detail.',
    isFeatured: false,
    displayOrder: 4,
    status: 'active',
  },
  {
    name: "Editor's Picks",
    slug: 'editors-picks',
    description: 'Hand-selected favourites from the SILKILINEN edit — pieces that define the collection.',
    isFeatured: false,
    displayOrder: 5,
    status: 'active',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const data of COLLECTIONS) {
    const existing = await Collection.findOne({ slug: data.slug });
    if (existing) {
      console.log(`[skip] "${data.name}" already exists`);
      continue;
    }
    const col = new Collection(data);
    await col.save();
    console.log(`[created] "${data.name}" (${data.slug})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
