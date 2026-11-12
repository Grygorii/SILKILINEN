type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Input = { search: string; referrer: string; pathname: string; hostname: string };
const clean = (value: string | null, limit = 200) => (value || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, limit);
const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, '');
export function captureAcquisition(storage: Store, input: Input): void {
  try {
    const params = new URLSearchParams(input.search), tagged = clean(params.get('utm_source'), 100);
    if (!tagged && storage.getItem('attr_source')) return;
    let source = tagged || 'direct', medium = tagged ? clean(params.get('utm_medium')) || 'none' : 'none', referrer = '';
    try {
      const url = new URL(input.referrer);
      if (['http:', 'https:'].includes(url.protocol)) {
        const host = bareHost(url.hostname), own = bareHost(input.hostname);
        if (host !== own && host !== 'silkilinen.com' && !host.endsWith('.silkilinen.com')) {
          referrer = url.origin;
          if (!tagged) {
            if (/(^|\.)google\.[a-z.]+$|(^|\.)(bing|yahoo|duckduckgo|baidu)\.com$/.test(host)) { source = host.includes('google.') ? 'google' : host.split('.').at(-2)!; medium = 'organic'; }
            else if (/(^|\.)(facebook|instagram|tiktok|pinterest|twitter|x)\.com$|^t\.co$/.test(host)) { source = /(^|\.)(x|twitter)\.com$|^t\.co$/.test(host) ? 'twitter' : host.split('.').at(-2)!; medium = 'social'; }
            else { source = host; medium = 'referral'; }
          }
        }
      }
    } catch { /* A missing referrer is not a known acquisition source. */ }
    const values = { source, medium, campaign: tagged ? clean(params.get('utm_campaign')) || 'none' : 'none', referrer, landing: clean(input.pathname, 400) };
    for (const key of ['medium','campaign','referrer','landing'] as const) storage.setItem(`attr_${key}`, values[key]);
    storage.setItem('attr_source', source);
  } catch { /* Optional attribution must not break browsing or checkout. */ }
}
