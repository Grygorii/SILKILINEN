// Shared by checkout and the delivery map. Keep coverage explicit; no new destinations are enabled here.
export const DELIVERY_COUNTRIES = [
  'IE',
  'GB', 'IM', 'JE', 'GG',
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'US', 'CA', 'AU', 'NZ',
  'CH', 'NO', 'IS',
] as const;
