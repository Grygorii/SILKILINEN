const COLOUR_MAP: Record<string, string> = {
  // Neutrals
  white: '#ffffff',
  ivory: '#fffff0',
  cream: '#fffdd0',
  ecru: '#f2efe4',
  off_white: '#f8f5f0',
  'off-white': '#f8f5f0',
  champagne: '#f7e7ce',
  sand: '#c2b280',
  nude: '#e8c9a0',
  beige: '#f5f0e8',
  linen: '#e8dcc8',
  oat: '#d4c9b4',
  stone: '#b0a090',
  taupe: '#b09080',
  mushroom: '#c4b5a5',

  // Greys
  grey: '#9e9e9e',
  gray: '#9e9e9e',
  silver: '#c0c0c0',
  slate: '#708090',
  charcoal: '#36454f',

  // Black & near-black
  black: '#1a1a1a',
  onyx: '#353839',
  ebony: '#555d50',

  // Browns
  caramel: '#c68642',
  camel: '#c19a6b',
  chocolate: '#7b3f00',
  mocha: '#967259',
  coffee: '#6f4e37',
  tan: '#d2b48c',
  rust: '#b7410e',
  terracotta: '#e2725b',
  clay: '#c36a2d',
  tobacco: '#a0522d',

  // Pinks & reds
  blush: '#de8ca5',
  rose: '#ff007f',
  dusty_rose: '#c4a0a0',
  'dusty-rose': '#c4a0a0',
  dustyrose: '#c4a0a0',
  pink: '#ffc0cb',
  mauve: '#e0b0c0',
  rouge: '#c23b22',
  red: '#cc2020',
  burgundy: '#800020',
  wine: '#722f37',
  merlot: '#6d2b3d',
  cherry: '#8b0000',
  raspberry: '#872657',
  watermelon: '#fc6c85',
  coral: '#ff6f61',
  peach: '#ffcba4',
  salmon: '#fa8072',

  // Oranges & yellows
  orange: '#e88035',
  amber: '#ffbf00',
  gold: '#ffd700',
  mustard: '#ffdb58',
  yellow: '#ffde00',
  lemon: '#fff44f',

  // Greens
  green: '#4caf50',
  sage: '#9caf88',
  olive: '#808000',
  forest: '#228b22',
  emerald: '#50c878',
  mint: '#98ff98',
  seafoam: '#9fe2bf',
  moss: '#8a9a5b',
  khaki: '#c3b091',
  army: '#4b5320',

  // Blues
  blue: '#4169e1',
  navy: '#001f5b',
  cobalt: '#0047ab',
  royal: '#4169e1',
  sky: '#87ceeb',
  powder: '#b0e0e6',
  steel: '#4682b4',
  denim: '#1560bd',
  teal: '#008080',
  ocean: '#006994',
  midnight: '#191970',

  // Purples
  purple: '#800080',
  lavender: '#e6e6fa',
  lilac: '#c8a2c8',
  violet: '#ee82ee',
  plum: '#8e4585',
  mulberry: '#c54b8c',
  orchid: '#da70d6',
  amethyst: '#9966cc',
  indigo: '#4b0082',
};

export function colourToHex(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '_');
  return COLOUR_MAP[key] ?? COLOUR_MAP[name.toLowerCase()] ?? null;
}
