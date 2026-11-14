'use strict';

// One owner for Journal Factory data.  It combines consented first-party
// reading signals with optional Search Console evidence without creating a
// second analytics store or asking an AI model to invent article topics.

const JournalArticle = require('../models/JournalArticle');
const Visit = require('../models/Visit');
const Event = require('../models/Event');
const searchConsole = require('./searchConsole');

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_DAYS = new Set([7, 30, 90]);
const MAX_IDEAS = 6;

function normaliseJournalDays(value) {
  const days = Number(value);
  return ALLOWED_DAYS.has(days) ? days : 30;
}

function articlePath(slug) {
  return `/journal/${String(slug || '').trim()}`;
}

function topicWords(value) {
  return [...new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['silk', 'with', 'what', 'when', 'your', 'from', 'that', 'this', 'the', 'and', 'for'].includes(word)),
  )];
}

function topicIsCovered(topic, articles) {
  const words = topicWords(topic);
  if (!words.length) return false;

  return articles.some(article => {
    const haystack = `${article.title || ''} ${(article.keywords || []).join(' ')}`.toLowerCase();
    const matches = words.filter(word => haystack.includes(word)).length;
    return matches >= Math.min(2, words.length);
  });
}

function articleForSearchPage(page, articles) {
  let pathname = '';
  try {
    pathname = new URL(String(page || '')).pathname;
  } catch {
    return null;
  }
  return articles.find(article => pathname === articlePath(article.slug)) || null;
}

function buildJournalIdeas({ articles, googleQueries, journalQueryRows, siteSearches }) {
  const ideas = [];
  const seen = new Set();
  const journalRowsByQuery = new Map();

  for (const row of journalQueryRows || []) {
    const key = String(row.query || '').trim().toLowerCase();
    if (!key) continue;
    const prior = journalRowsByQuery.get(key);
    if (!prior || Number(row.impressions || 0) > Number(prior.impressions || 0)) journalRowsByQuery.set(key, row);
  }

  for (const query of googleQueries || []) {
    const phrase = String(query.query || '').trim();
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(`topic:${key}`) || topicWords(phrase).length < 2) continue;

    const existingRow = journalRowsByQuery.get(key);
    const existingArticle = existingRow && articleForSearchPage(existingRow.page, articles);
    if (existingArticle) {
      const ideaKey = `refresh:${existingArticle.slug}`;
      if (seen.has(ideaKey)) continue;
      seen.add(ideaKey);
      ideas.push({
        kind: 'refresh',
        title: existingArticle.title,
        topic: phrase,
        articleId: String(existingArticle._id),
        articleSlug: existingArticle.slug,
        source: 'Google Search Console',
        evidence: `${Number(existingRow.impressions || 0)} Google impressions, ${Number(existingRow.clicks || 0)} clicks, average position ${Number(existingRow.position || 0).toFixed(1)}.`,
        action: 'Improve this existing article for the query instead of creating a competing page.',
      });
      continue;
    }

    if (topicIsCovered(phrase, articles)) continue;
    seen.add(`topic:${key}`);
    ideas.push({
      kind: 'new',
      title: phrase,
      topic: phrase,
      source: 'Google Search Console',
      evidence: `${Number(query.impressions || 0)} Google impressions, ${Number(query.clicks || 0)} clicks, average position ${Number(query.position || 0).toFixed(1)}.`,
      action: 'Review the angle, then create a draft. The AI will only create a draft for you to approve.',
    });
  }

  for (const search of siteSearches || []) {
    const phrase = String(search.term || '').trim();
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(`topic:${key}`) || topicIsCovered(phrase, articles)) continue;
    seen.add(`topic:${key}`);
    ideas.push({
      kind: 'research',
      title: phrase,
      topic: phrase,
      source: 'On-site search',
      evidence: `${Number(search.sessions || 0)} tracked browser session${Number(search.sessions || 0) === 1 ? '' : 's'} searched for this and saw no product results.`,
      action: 'Check whether this needs a product, a better search synonym, or a useful article before drafting.',
    });
  }

  return ideas.slice(0, MAX_IDEAS);
}

function addSessions(target, sessions) {
  for (const session of sessions || []) {
    if (session) target.add(String(session));
  }
}

async function getJournalInsights({ days } = {}) {
  const periodDays = normaliseJournalDays(days);
  const since = new Date(Date.now() - periodDays * DAY_MS);
  const articles = await JournalArticle.find({ status: 'published', slug: { $type: 'string', $ne: '' } })
    .select('title slug publishedAt keywords')
    .sort({ publishedAt: -1 })
    .lean();
  const paths = articles.map(article => articlePath(article.slug));

  const slugs = articles.map(article => article.slug);
  const [visitRows, eventRows, cardClickRows, siteSearchRows, google] = await Promise.all([
    paths.length
      ? Visit.aggregate([
        { $match: { createdAt: { $gte: since }, page: { $in: paths } } },
        { $group: {
          _id: { page: '$page', source: { $ifNull: ['$source', 'direct'] } },
          opens: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
        } },
      ])
      : [],
    slugs.length
      ? Event.aggregate([
        { $match: {
          createdAt: { $gte: since },
          'props.article': { $in: slugs },
          type: { $in: ['journal_read_50', 'journal_read_complete', 'journal_product_click', 'journal_shop_click', 'journal_shop_collection', 'card_click'] },
        } },
        { $group: { _id: { article: '$props.article', type: '$type' }, sessions: { $addToSet: '$sessionId' }, events: { $sum: 1 } } },
      ])
      : [],
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'journal_article_click', 'props.article': { $in: slugs } } },
      { $group: { _id: '$props.article', sessions: { $addToSet: '$sessionId' }, events: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'search', 'props.no_results': true } },
      { $group: { _id: '$props.search_term', sessions: { $addToSet: '$sessionId' }, searches: { $sum: 1 } } },
      { $sort: { searches: -1 } },
      { $limit: 20 },
    ]),
    (async () => {
      const connected = await searchConsole.isConnected().catch(() => false);
      if (!connected) return { connected: false, pages: [], queries: [], pairs: [] };
      const [pages, queries, pairs] = await Promise.all([
        searchConsole.getJournalPagePerformance(periodDays).catch(() => []),
        searchConsole.getQueryOpportunities(periodDays).catch(() => []),
        searchConsole.getJournalQueryPerformance(periodDays).catch(() => []),
      ]);
      return { connected: true, pages, queries, pairs };
    })(),
  ]);

  const metricsByPath = new Map(paths.map(path => [path, {
    opens: 0,
    readers: new Set(),
    read50: new Set(),
    completed: new Set(),
    productClicks: new Set(),
    shopClicks: new Set(),
    cardClicks: new Set(),
    sourceReaders: new Map(),
  }]));

  for (const row of visitRows) {
    const metric = metricsByPath.get(row._id?.page);
    if (!metric) continue;
    metric.opens += Number(row.opens || 0);
    addSessions(metric.readers, row.sessions);
    const source = String(row._id?.source || 'direct');
    if (!metric.sourceReaders.has(source)) metric.sourceReaders.set(source, new Set());
    addSessions(metric.sourceReaders.get(source), row.sessions);
  }

  for (const row of eventRows) {
    const metric = metricsByPath.get(articlePath(row._id?.article));
    if (!metric) continue;
    const sessions = row.sessions || [];
    if (row._id?.type === 'journal_read_50') addSessions(metric.read50, sessions);
    if (row._id?.type === 'journal_read_complete') addSessions(metric.completed, sessions);
    if (row._id?.type === 'journal_product_click' || row._id?.type === 'card_click') addSessions(metric.productClicks, sessions);
    if (row._id?.type === 'journal_shop_click' || row._id?.type === 'journal_shop_collection') addSessions(metric.shopClicks, sessions);
  }

  for (const row of cardClickRows) {
    const metric = metricsByPath.get(articlePath(row._id));
    if (metric) addSessions(metric.cardClicks, row.sessions);
  }

  const googleByPath = new Map((google.pages || []).map(row => {
    try { return [new URL(row.page).pathname, row]; } catch { return [row.page, row]; }
  }));
  const allReaders = new Set();
  const allRead50 = new Set();
  const allCompleted = new Set();
  const allCardClicks = new Set();
  const allProductClicks = new Set();
  const allShopClicks = new Set();
  let totalOpens = 0;

  const articleMetrics = articles.map(article => {
    const path = articlePath(article.slug);
    const metric = metricsByPath.get(path);
    const sources = [...metric.sourceReaders.entries()]
      .map(([source, sessions]) => ({ source, readers: sessions.size }))
      .sort((a, b) => b.readers - a.readers)
      .slice(0, 3);
    const search = googleByPath.get(path) || null;
    addSessions(allReaders, metric.readers);
    addSessions(allRead50, metric.read50);
    addSessions(allCompleted, metric.completed);
    addSessions(allCardClicks, metric.cardClicks);
    addSessions(allProductClicks, metric.productClicks);
    addSessions(allShopClicks, metric.shopClicks);
    totalOpens += metric.opens;

    return {
      id: String(article._id),
      title: article.title,
      slug: article.slug,
      publishedAt: article.publishedAt || null,
      opens: metric.opens,
      readers: metric.readers.size,
      read50: metric.read50.size,
      completed: metric.completed.size,
      productClicks: metric.productClicks.size,
      shopClicks: metric.shopClicks.size,
      cardClicks: metric.cardClicks.size,
      sources,
      google: search ? {
        clicks: Number(search.clicks || 0),
        impressions: Number(search.impressions || 0),
        ctr: Number(search.ctr || 0),
        position: Number(search.position || 0),
      } : null,
    };
  }).sort((a, b) => b.readers - a.readers || b.opens - a.opens || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

  const siteSearches = siteSearchRows
    .map(row => ({ term: String(row._id || '').trim(), sessions: (row.sessions || []).filter(Boolean).length, searches: Number(row.searches || 0) }))
    .filter(row => row.term.length >= 3);

  return {
    days: periodDays,
    firstPartyWindowDays: 90,
    googleConnected: google.connected,
    summary: {
      readers: allReaders.size,
      opens: totalOpens,
      read50: allRead50.size,
      completed: allCompleted.size,
      cardClicks: allCardClicks.size,
      productClicks: allProductClicks.size,
      shopClicks: allShopClicks.size,
    },
    articles: articleMetrics,
    ideas: buildJournalIdeas({
      articles,
      googleQueries: google.queries,
      journalQueryRows: google.pairs,
      siteSearches,
    }),
  };
}

module.exports = {
  normaliseJournalDays,
  articlePath,
  topicIsCovered,
  buildJournalIdeas,
  getJournalInsights,
};
