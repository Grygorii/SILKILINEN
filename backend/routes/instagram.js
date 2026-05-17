const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Simple in-memory cache (1hr TTL)
let cache = { posts: null, fetchedAt: null, error: null, tokenRefreshedAt: null };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const IG_BASE = 'https://graph.instagram.com';
const FIELDS = 'id,media_url,permalink,caption,media_type,timestamp,thumbnail_url';

function getToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN || '';
}

async function fetchFromInstagram() {
  const token = getToken();
  if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');

  const url = `${IG_BASE}/me/media?fields=${FIELDS}&access_token=${token}&limit=12`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Instagram API ${res.status}`);
  }
  const data = await res.json();
  return (data.data || []).map(post => ({
    id: post.id,
    media_url: post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url,
    permalink: post.permalink,
    caption: post.caption || '',
    media_type: post.media_type,
    timestamp: post.timestamp,
  }));
}

async function refreshToken() {
  const token = getToken();
  if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');

  const url = `${IG_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  const data = await res.json();
  return data; // { access_token, token_type, expires_in }
}

// ── GET /api/instagram/posts — public, cached ─────────────────────────────────
router.get('/posts', async (req, res) => {
  const limit = Math.min(12, parseInt(req.query.limit) || 6);

  // Serve from cache if still fresh
  if (cache.posts && cache.fetchedAt && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return res.json(cache.posts.slice(0, limit));
  }

  try {
    const posts = await fetchFromInstagram();
    cache = { posts, fetchedAt: Date.now(), error: null, tokenRefreshedAt: cache.tokenRefreshedAt };
    res.json(posts.slice(0, limit));
  } catch (err) {
    cache.error = err.message;
    // If we have stale cache, return it rather than an empty response
    if (cache.posts) return res.json(cache.posts.slice(0, limit));
    res.status(502).json({ error: err.message });
  }
});

// ── POST /api/admin/instagram/refresh-token — admin only ──────────────────────
router.post('/refresh-token', requireAuth, async (req, res) => {
  try {
    const result = await refreshToken();
    cache.tokenRefreshedAt = Date.now();
    cache.posts = null; // force fresh fetch on next request
    res.json({ success: true, expiresIn: result.expires_in });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/instagram/status — admin only ──────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const configured = !!getToken();
  res.json({
    configured,
    cachedPostCount: cache.posts?.length ?? 0,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    tokenRefreshedAt: cache.tokenRefreshedAt ? new Date(cache.tokenRefreshedAt).toISOString() : null,
    lastError: cache.error || null,
    cacheTtlMinutes: CACHE_TTL / 60000,
  });
});

module.exports = router;
