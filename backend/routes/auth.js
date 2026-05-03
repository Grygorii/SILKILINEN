const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// 5 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  handler(req, res, next, options) {
    console.warn(`[AUTH] Rate limit hit: ${req.ip} | ${new Date().toISOString()}`);
    res.status(429).json(options.message);
  },
});

router.post('/login', loginLimiter, async function(req, res) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`[AUTH] Failed login (no user): ${email} | ip=${ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn(`[AUTH] Failed login (bad password): ${email} | ip=${ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      console.warn(`[AUTH] Non-admin login attempt: ${email} | role=${user.role} | ip=${ip}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    console.log(`[AUTH] Admin login: ${email} | ip=${ip}`);
    // Return token in body so the Vercel frontend can set a same-domain
    // httpOnly cookie for its Edge middleware (cross-domain cookie workaround).
    res.json({ success: true, token });
  } catch (err) {
    console.error(`[AUTH] Login error: ip=${ip} | ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', function(req, res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
});

// Verify current session — used by the admin layout server component
router.get('/me', requireAuth, async function(req, res) {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ _id: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
