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

  const expectedAspect = tier.width / tier.height; // e.g. 0.8 for 4:5

  // Hard fails only — these indicate a broken/blank generation worth retrying.
  // Resolution is NOT a hard fail: Gemini caps output at ~1024×1280 regardless of
  // imageConfig, so checking against requested dimensions always fails for HD/Premium.
  // We log it but let the admin decide whether the quality is acceptable.
  const checks = {
    fileSize: imageBuffer.length > 50_000,   // < 50 KB = almost certainly broken
    aspectRatio: Math.abs((metadata.width / metadata.height) - expectedAspect) < 0.2,
    notBlank: avgStdDev > 8,                 // stdev ≤ 8 = solid colour / blank
  };

  const passed = Object.values(checks).every(Boolean);

  // Informational resolution check (logged, not a hard fail)
  const resolutionOk = metadata.width >= tier.width * 0.85 && metadata.height >= tier.height * 0.85;

  console.log('[AI Validate]', {
    tier: tier.label,
    expected: { width: tier.width, height: tier.height, aspect: expectedAspect.toFixed(3) },
    actual: { width: metadata.width, height: metadata.height, aspect: (metadata.width / metadata.height).toFixed(3) },
    fileSizeKB: Math.round(imageBuffer.length / 1000),
    stdDev: avgStdDev.toFixed(1),
    resolutionOk,
    checks,
    passed,
  });

  return {
    passed,
    checks: {
      ...checks,
      resolution: resolutionOk, // included for UI display, not used in passed logic
    },
    resolutionInfo: {
      ok: resolutionOk,
      actual: { width: metadata.width, height: metadata.height },
      requested: { width: tier.width, height: tier.height },
    },
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
