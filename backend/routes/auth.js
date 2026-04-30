const JWT_SECRET = 'silkilinen_super_secret_key';
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/login', async function(req, res) {
  try {
    console.log('JWT_SECRET in auth:', process.env.JWT_SECRET ? 'loaded' : 'MISSING');
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
  { userId: user._id, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', function(req, res) {
  res.clearCookie('token');
  res.json({ success: true });
});

module.exports = router;