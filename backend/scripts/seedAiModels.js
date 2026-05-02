/**
 * One-time seed: creates the 5 SILKILINEN brand AI models.
 * Run: node scripts/seedAiModels.js
 * Models are skipped if they already exist (idempotent).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AiModel = require('../models/AiModel');

const MODELS = [
  {
    name: 'Aoife',
    heritage: 'Irish/Celtic',
    description: 'Warm romantic lead. Homepage hero, sleepwear, soft lifestyle content.',
    prompt: 'A woman in her late 20s with Irish and Celtic heritage. She has long auburn wavy hair that falls past her shoulders, fair skin with soft natural freckles across her nose and cheeks, and bright green eyes. Her expression is warm, soft, and naturally feminine — unhurried, luminous, romantically beautiful. Delicate bone structure, a gentle open expression. No heavy makeup — fresh, clean, natural. She radiates quiet warmth and approachable beauty.',
    useCases: ['robes', 'shirts', 'dresses', 'sleepwear'],
    markets: ['IE'],
    active: true,
    locked: false,
  },
  {
    name: 'Charlotte',
    heritage: 'British',
    description: 'Polished editorial. Scarves, refined pieces, clean lookbook content.',
    prompt: 'A woman in her late 20s to early 30s with British heritage. She has long dark brown straight hair with a natural healthy shine, fair to medium skin with cool neutral undertones, and dark confident eyes. Her expression is composed, polished, and classically editorial — clean refined features, poised posture, a hint of cool sophisticated confidence. Think high-fashion editorial meets quiet elegance.',
    useCases: ['scarves', 'dresses', 'shirts'],
    markets: ['GB'],
    active: true,
    locked: false,
  },
  {
    name: 'Sofia',
    heritage: 'Italian/Mediterranean',
    description: 'Warm sensual. Robes, shorts, pyjamas, richly styled editorial.',
    prompt: 'A woman in her late 20s with Italian and Mediterranean heritage. She has long dark brown soft wavy hair, warm olive skin with a natural glow, and deep dark expressive eyes. Her expression is warm, sensual, and naturally confident — full lips, an expressive gaze, the relaxed elegance of someone completely at ease. She radiates Mediterranean warmth. Bold yet inherently feminine beauty.',
    useCases: ['robes', 'shorts', 'dresses'],
    markets: ['DE', 'FR', 'IT', 'ES', 'EU'],
    active: true,
    locked: false,
  },
  {
    name: 'Maya',
    heritage: 'Mixed/American',
    description: 'Modern confident. Dresses, shorts, contemporary editorial.',
    prompt: 'A woman in her late 20s with mixed American heritage. She has long black wavy hair, warm light brown skin, and dark expressive eyes with high cheekbones. Her expression is modern, confident, and energetic — strong natural presence, a genuine warm smile, effortless contemporary style. She projects urban editorial confidence — real, approachable, and naturally beautiful.',
    useCases: ['dresses', 'shorts', 'shirts'],
    markets: ['US', 'CA'],
    active: true,
    locked: false,
  },
  {
    name: 'Yuki',
    heritage: 'East Asian',
    description: 'Minimalist elegant. Accessories, scarves, sleep masks, clean aesthetic.',
    prompt: 'A woman in her late 20s with East Asian heritage. She has straight black hair cut to just below the shoulder, fair porcelain skin, and dark almond-shaped eyes. Her expression is calm, serene, and minimally elegant — quiet sophistication, effortless composure, a clean precisely beautiful face. No heavy makeup. Her presence is deliberately understated — refined, graceful, utterly composed.',
    useCases: ['scarves', 'accessories', 'shirts'],
    markets: ['JP', 'KR', 'SG', 'AU'],
    active: true,
    locked: false,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Seeding AI models…\n');

  for (const data of MODELS) {
    const exists = await AiModel.findOne({ name: data.name });
    if (exists) {
      console.log(`  Skip  ${data.name} — already exists`);
      continue;
    }
    await AiModel.create(data);
    console.log(`  Created ${data.name} (${data.heritage})`);
  }

  console.log('\nSeed complete. Next step: go to /admin/models and generate a reference photo for each model.');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
