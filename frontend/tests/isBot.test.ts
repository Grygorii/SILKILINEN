import { describe, it, expect } from 'vitest';
import { botName, isBot } from '@/lib/isBot';

// botName() decides BOTH whether something is a bot and what to call it, so the
// two answers cannot drift apart — isBot() is derived from it rather than
// keeping a second pattern list. Two lists was the obvious shape and would have
// been this codebase's signature bug: traffic classed as a bot by one and named
// by neither, or worse, dropped from Visit by one while counted by the other.

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('botName', () => {
  it('lets a real browser through', () => {
    expect(botName(CHROME)).toBeNull();
    expect(botName(IPHONE)).toBeNull();
    expect(isBot(CHROME)).toBe(false);
  });

  it('names the crawlers whose absence is a decision', () => {
    expect(botName('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Googlebot');
    expect(botName('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe('Bingbot');
    expect(botName('Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)')).toBe('GPTBot');
    expect(botName('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe('ClaudeBot');
    expect(botName('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe('PerplexityBot');
  });

  it('prefers the specific name over the generic catch-all', () => {
    // Every one of these also matches /bot|crawl|spider/. Order is the whole
    // mechanism, and a reordering would quietly collapse the table into one
    // "Other bot" row that answers none of the questions the panel exists for.
    for (const [ua, name] of [
      ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'AhrefsBot'],
      ['Mozilla/5.0 (compatible; SemrushBot/7~bl)', 'SemrushBot'],
      ['Mozilla/5.0 (compatible; YandexBot/3.0)', 'YandexBot'],
    ] as [string, string][]) {
      expect(botName(ua), ua).toBe(name);
    }
  });

  it('still catches a bot it has no name for', () => {
    expect(botName('SomeNewCrawler/1.0 (+http://example.com/bot)')).toBe('Other bot');
  });

  it('treats a missing user-agent as automated', () => {
    // Real browsers always send one. Naming it rather than returning a bare
    // true means the panel shows what it is instead of an unexplained row.
    expect(botName('')).toBe('No user-agent');
    expect(botName(null)).toBe('No user-agent');
    expect(botName(undefined)).toBe('No user-agent');
    expect(isBot(null)).toBe(true);
  });

  it('can never disagree with itself', () => {
    for (const ua of [CHROME, IPHONE, 'Googlebot/2.1', 'curl/8.1.2', '', 'GPTBot/1.1']) {
      expect(isBot(ua), ua).toBe(botName(ua) !== null);
    }
  });
});
