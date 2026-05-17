const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const SocialPlatform = require('../models/SocialPlatform');
const SocialPost = require('../models/SocialPost');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function uploadToCloudinary(buffer, opts) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    }).end(buffer);
  });
}

// ─── Platform registry ────────────────────────────────────────────────────────

// GET /api/admin/social/platforms — list all platforms
router.get('/platforms', requireAuth, async (req, res) => {
  try {
    const platforms = await SocialPlatform.find().sort({ sortOrder: 1, displayName: 1 }).lean();
    res.json(platforms);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/admin/social/platforms — create new platform
router.post('/platforms', requireAuth, async (req, res) => {
  try {
    const { key, displayName, icon, brandColor, baseUrl, captionMaxChars, captionRecommended,
            hashtagsAllowed, hashtagsRecommended, hashtagsMax, tips, sortOrder } = req.body;
    if (!key || !displayName || !icon) {
      return res.status(400).json({ error: 'key, displayName, and icon are required' });
    }
    const platform = await SocialPlatform.create({
      key: key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      displayName, icon, brandColor, baseUrl,
      captionMaxChars: captionMaxChars || 500,
      captionRecommended: captionRecommended || undefined,
      hashtagsAllowed: hashtagsAllowed !== false,
      hashtagsRecommended: hashtagsRecommended || 0,
      hashtagsMax: hashtagsMax || undefined,
      imageSpecs: [{ aspectRatio: '1:1', label: 'Square', pixelWidth: 1080, pixelHeight: 1080, isDefault: true }],
      tips: tips || [],
      sortOrder: sortOrder || 99,
    });
    res.status(201).json(platform);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Platform key already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/social/platforms/:key — full update
router.put('/platforms/:key', requireAuth, async (req, res) => {
  try {
    const allowed = ['displayName','icon','brandColor','baseUrl','imageSpecs','captionMaxChars',
                     'captionRecommended','hashtagsAllowed','hashtagsRecommended','hashtagsMax',
                     'supportsVideo','supportsCarousel','supportsAltText','tips','isActive','sortOrder'];
    const update = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    const platform = await SocialPlatform.findOneAndUpdate({ key: req.params.key }, update, { new: true });
    if (!platform) return res.status(404).json({ error: 'Not found' });
    res.json(platform);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH /api/admin/social/platforms/:key/url — set the connection URL for a platform
router.patch('/platforms/:key/url', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    const platform = await SocialPlatform.findOneAndUpdate(
      { key: req.params.key },
      { url: url || '' },
      { new: true }
    );
    if (!platform) return res.status(404).json({ error: 'Not found' });
    res.json(platform);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Social posts ─────────────────────────────────────────────────────────────

// GET /api/admin/social/posts
router.get('/posts', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const posts = await SocialPost.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
    res.json(posts);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/admin/social/posts — create empty draft
router.post('/posts', requireAuth, async (req, res) => {
  try {
    const post = await SocialPost.create({
      title: req.body.title || '',
      defaultCaption: '',
      status: 'draft',
      lastEditedBy: req.user?.userId || 'admin',
    });
    res.status(201).json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/admin/social/posts/:id
router.get('/posts/:id', requireAuth, async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/admin/social/posts/:id — full save
router.put('/posts/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['title','defaultCaption','defaultImages','defaultHashtags',
                     'primaryImageIndex','platformVariations','status'];
    const update = { updatedAt: new Date(), lastEditedBy: req.user?.userId || 'admin' };
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];

    // Auto-set postedAt when all enabled platforms are checked off
    if (req.body.postedTo) update.postedTo = req.body.postedTo;
    if (update.status === 'posted' && !update.postedAt) update.postedAt = new Date();

    const post = await SocialPost.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/admin/social/posts/:id/autosave — lightweight autosave
router.post('/posts/:id/autosave', requireAuth, async (req, res) => {
  try {
    const { defaultCaption, platformVariations, defaultHashtags, title } = req.body;
    const update = { updatedAt: new Date(), lastEditedBy: req.user?.userId || 'admin' };
    if (defaultCaption !== undefined) update.defaultCaption = defaultCaption;
    if (platformVariations !== undefined) update.platformVariations = platformVariations;
    if (defaultHashtags !== undefined) update.defaultHashtags = defaultHashtags;
    if (title !== undefined) update.title = title;
    await SocialPost.findByIdAndUpdate(req.params.id, update);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH /api/admin/social/posts/:id/posted-to — mark platform as posted / unposted
router.patch('/posts/:id/posted-to', requireAuth, async (req, res) => {
  try {
    const { platformKey, posted, note } = req.body;
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });

    // Remove existing entry for this platform
    post.postedTo = post.postedTo.filter(p => p.platformKey !== platformKey);

    if (posted) {
      post.postedTo.push({ platformKey, postedAt: new Date(), postedBy: req.user?.userId || 'admin', note: note || '' });
    }

    // Auto-status: if all enabled platform variations are checked, set posted
    const enabledKeys = post.platformVariations.filter(v => v.enabled).map(v => v.platformKey);
    const checkedKeys = post.postedTo.map(p => p.platformKey);
    const allChecked  = enabledKeys.length > 0 && enabledKeys.every(k => checkedKeys.includes(k));
    if (allChecked) { post.status = 'posted'; post.postedAt = new Date(); }
    else if (post.status === 'posted') post.status = 'ready';

    await post.save();
    res.json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/admin/social/posts/:id/images — upload image(s) to post
router.post('/posts/:id/images', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });

    const uploaded = [];
    for (const file of req.files || []) {
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'silkilinen/social',
        resource_type: 'image',
      });
      uploaded.push({ url: result.secure_url, cloudinaryId: result.public_id, altText: '' });
    }

    post.defaultImages.push(...uploaded);
    await post.save();
    res.json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/admin/social/posts/:id/images/:index — remove image by index
router.delete('/posts/:id/images/:index', requireAuth, async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    const idx = Number(req.params.index);
    const [removed] = post.defaultImages.splice(idx, 1);
    if (removed?.cloudinaryId) {
      await cloudinary.uploader.destroy(removed.cloudinaryId).catch(() => {});
    }
    await post.save();
    res.json(post);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/admin/social/posts/:id — delete post
router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    // Cleanup Cloudinary images
    for (const img of post.defaultImages) {
      if (img.cloudinaryId) await cloudinary.uploader.destroy(img.cloudinaryId).catch(() => {});
    }
    await post.deleteOne();
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
