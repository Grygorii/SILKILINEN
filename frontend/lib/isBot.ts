// Identify automated traffic (search crawlers, scrapers, headless tools,
// uptime monitors) by User-Agent.
//
// Why this matters: Googlebot and friends render pages with JavaScript, which
// fires the /api/track/visit beacon — so without this filter, crawlers from
// Google's data centres (Mountain View / San Jose) get logged as real "direct"
// visitors, inflating traffic and crushing the conversion rate toward 0.
//
// A missing/empty UA is treated as a bot too — real browsers always send one.
//
// `botName()` is the owner: it decides BOTH whether something is a bot and what
// to call it, so the two answers cannot disagree. Crawler volume is worth
// seeing rather than discarding — GPTBot tells you whether AI search is reading
// the catalogue, Ahrefs/Semrush tell you competitors are watching — so the
// visit proxy records these separately instead of dropping them. They never
// reach the Visit collection; see backend/models/BotHit.js for why.

// Ordered: the first match wins, so specific names sit above the generic
// /bot|crawl|spider/ catch-all that would otherwise swallow them.
const NAMED: [RegExp, string][] = [
  [/googlebot|mediapartners-google|adsbot-google/i, 'Googlebot'],
  [/bingbot|bingpreview|adidxbot/i,                 'Bingbot'],
  [/gptbot|oai-searchbot|chatgpt-user/i,            'GPTBot'],
  [/claudebot|claude-web|anthropic-ai/i,            'ClaudeBot'],
  [/perplexitybot|perplexity-user/i,                'PerplexityBot'],
  [/google-extended/i,                              'Google-Extended'],
  [/applebot/i,                                     'Applebot'],
  [/duckduckbot|duckduckgo/i,                       'DuckDuckBot'],
  [/yandex/i,                                       'YandexBot'],
  [/baiduspider|baidu/i,                            'Baiduspider'],
  [/ahrefsbot|ahrefs/i,                             'AhrefsBot'],
  [/semrushbot|semrush/i,                           'SemrushBot'],
  [/mj12bot|dotbot|petalbot|ia_archiver/i,          'SEO crawler'],
  [/facebookexternalhit|facebot/i,                  'Facebook'],
  [/pinterest/i,                                    'Pinterest'],
  [/twitterbot/i,                                   'Twitterbot'],
  [/slackbot|discordbot|whatsapp|telegrambot/i,     'Link preview'],
  [/uptimerobot|pingdom|gtmetrix|lighthouse|statuscake/i, 'Monitoring'],
  [/headless|phantomjs|puppeteer|playwright|selenium/i,   'Headless browser'],
  [/curl|wget|python-requests|node-fetch|axios|go-http|okhttp|java\//i, 'Script'],
  // Generic last — anything self-identifying as a bot that we have no name for.
  [/bot|crawl|spider|slurp|scraper/i,               'Other bot'],
];

/** The bot's display name, or null when the UA looks like a real browser. */
export function botName(userAgent: string | null | undefined): string | null {
  if (!userAgent || !userAgent.trim()) return 'No user-agent';
  for (const [re, name] of NAMED) if (re.test(userAgent)) return name;
  return null;
}

export function isBot(userAgent: string | null | undefined): boolean {
  return botName(userAgent) !== null;
}
