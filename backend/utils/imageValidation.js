const sharp = require('sharp');

const QUALITY_TIERS = {
  standard: {
    label: 'Standard',
    resolution: '1K',
    width: 1024,
    height: 1280,
    estimatedCost: 0.05,
    description: 'For grid thumbnails and quick previews',
  },
  hd: {
    label: 'HD',
    resolution: '2K',
    width: 2048,
    height: 2560,
    estimatedCost: 0.13,
    description: 'For lifestyle shots and standard product images',
  },
  premium: {
    label: 'Premium',
    resolution: '4K',
    width: 4096,
    height: 5120,
    estimatedCost: 0.24,
    description: 'For reference photos and zoomable product details',
  },
};

const POSITION_DEFAULT_TIER = {
  reference: 'premium',
  detail: 'premium',
  front: 'hd',
  side: 'hd',
  lifestyle: 'hd',
};

function getTier(key) {
  return QUALITY_TIERS[key] || QUALITY_TIERS.hd;
}

function getDefaultTierKey(position) {
  return POSITION_DEFAULT_TIER[position] || 'hd';
}

async function validateGeneration(imageBuffer, tier) {
  const metadata = await sharp(imageBuffer).metadata();
  const stats = await sharp(imageBuffer).stats();
  const avgStdDev = stats.channels.reduce((sum, c) => sum + c.stdev, 0) / stats.channels.length;

  // Accept 50% of requested size — Gemini may not honour exact dimensions
  const minWidth = Math.floor(tier.width * 0.5);
  const minHeight = Math.floor(tier.height * 0.5);
  const expectedAspect = tier.width / tier.height;

  const checks = {
    resolution: metadata.width >= minWidth && metadata.height >= minHeight,
    fileSize: imageBuffer.length > 100_000,
    aspectRatio: Math.abs((metadata.width / metadata.height) - expectedAspect) < 0.15,
    notBlank: avgStdDev > 10,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length,
    },
  };
}

async function computeDHash(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

async function computeFaceHash(imageBuffer, faceBox) {
  if (!faceBox || !faceBox.width || !faceBox.height) return null;
  try {
    const face = await sharp(imageBuffer)
      .extract({
        left: Math.max(0, Math.round(faceBox.x)),
        top: Math.max(0, Math.round(faceBox.y)),
        width: Math.max(1, Math.round(faceBox.width)),
        height: Math.max(1, Math.round(faceBox.height)),
      })
      .toBuffer();
    return computeDHash(face);
  } catch {
    return null;
  }
}

function hashSimilarity(hashA, hashB) {
  if (!hashA || !hashB) return null;
  try {
    const a = BigInt('0x' + hashA);
    const b = BigInt('0x' + hashB);
    let diff = a ^ b;
    let ones = 0;
    while (diff > 0n) {
      ones += Number(diff & 1n);
      diff >>= 1n;
    }
    return 1 - ones / 64;
  } catch {
    return null;
  }
}

function identityMatchStatus(similarity) {
  if (similarity === null || similarity === undefined) return null;
  if (similarity >= 0.85) return 'good';
  if (similarity >= 0.70) return 'warning';
  return 'drifted';
}

module.exports = {
  QUALITY_TIERS,
  getTier,
  getDefaultTierKey,
  validateGeneration,
  computeDHash,
  computeFaceHash,
  hashSimilarity,
  identityMatchStatus,
};
