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

module.exports = { QUALITY_TIERS, getTier, getDefaultTierKey };
