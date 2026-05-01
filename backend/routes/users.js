const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// List all admin users — never return password field
router.get('/', requireAuth, async function(req, res) {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 });
    res.json({ users, currentUserId: req.user.userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new admin user
router.post('/', requireAuth, async function(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'An account with that email already exists' });
    }
    const user = await User.create({ email, password, role: 'admin' });
    res.status(201).json({ _id: user._id, email: user.email, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an admin user — cannot delete your own account
router.delete('/:id', requireAuth, async function(req, res) {
  try {
    if (req.user.userId.toString() === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
