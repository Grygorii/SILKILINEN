// Identify automated traffic (search crawlers, scrapers, headless tools,
// uptime monitors) by User-Agent so it can be kept out of visit analytics.
//
// Why this matters: Googlebot and friends render pages with JavaScript, which
// fires the /api/track/visit beacon — so without this filter, crawlers from
// Google's data centres (Mountain View / San Jose) get logged as real "direct"
// visitors, inflating traffic and crushing the conversion rate toward 0.
//
// A missing/empty UA is treated as a bot too — real browsers always send one.
const BOT_RE = /bot|crawl|spider|slurp|mediapartners|bingpreview|facebookexternalhit|facebot|ia_archiver|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baidu|duckduck|applebot|headless|lighthouse|gtmetrix|pingdom|uptimerobot|curl|wget|python-requests|node-fetch|axios|go-http|phantomjs|puppeteer|playwright/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_RE.test(userAgent);
}
