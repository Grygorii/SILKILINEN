const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { calculateShipping } = require('../services/shipping');
const { validateDiscount } = require('../services/discounts');

// Helper — compute cart totals
function summarise(cart) {
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = calculateShipping(cart.shippingCountry, subtotal - (cart.discountAmount || 0));
  const total = Math.max(0, subtotal - (cart.discountAmount || 0)) + shipping.cost;
  return { subtotal, shipping, total };
}

// GET /api/cart/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    let cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) {
      cart = await Cart.create({ sessionId: req.params.sessionId });
    }
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cart/:sessionId/items — add or increment item
router.post('/:sessionId/items', async (req, res) => {
  try {
    const { productId, colour, size, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const product = await Product.findOne({ _id: productId, status: { $in: ['active', 'sold_out'] } }).lean();
    if (!product) return res.status(400).json({ error: 'Product not found or unavailable' });

    let cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) cart = new Cart({ sessionId: req.params.sessionId });

    const existing = cart.items.find(
      i => i.productId.toString() === productId && i.colour === (colour || '') && i.size === (size || '')
    );
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity);
    } else {
      const primaryImg = product.images?.find(img => img.isPrimary) || product.images?.[0];
      cart.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: primaryImg?.url || product.image || '',
        colour: colour || '',
        size: size || '',
        quantity,
      });
    }

    // Bump expiry on activity
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await cart.save();
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/cart/:sessionId/items/:itemId — update quantity
router.patch('/:sessionId/items/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    if (quantity === 0) {
      cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
    } else {
      const item = cart.items.find(i => i._id.toString() === req.params.itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      item.quantity = quantity;
    }

    // Re-validate discount if present
    if (cart.discountCode) {
      const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const result = await validateDiscount(cart.discountCode, subtotal);
      cart.discountAmount = result.valid ? result.discountAmount : 0;
      if (!result.valid) cart.discountCode = null;
    }

    await cart.save();
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cart/:sessionId/items/:itemId
router.delete('/:sessionId/items/:itemId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
    if (cart.discountCode) {
      const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const result = await validateDiscount(cart.discountCode, subtotal);
      cart.discountAmount = result.valid ? result.discountAmount : 0;
      if (!result.valid) cart.discountCode = null;
    }
    await cart.save();
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cart/:sessionId/discount — apply or replace discount code
router.post('/:sessionId/discount', async (req, res) => {
  try {
    const { code } = req.body;
    const cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const result = await validateDiscount(code, subtotal);
    if (!result.valid) return res.status(400).json({ error: result.error });

    const replaced = !!cart.discountCode && cart.discountCode !== result.code;
    cart.discountCode = result.code;
    cart.discountAmount = result.discountAmount;
    await cart.save();

    res.json({
      ...cart.toObject(),
      ...summarise(cart),
      replaced,
      message: replaced ? `Code replaced — ${result.code} applied` : `${result.code} applied`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cart/:sessionId/discount — remove discount code
router.delete('/:sessionId/discount', async (req, res) => {
  try {
    const cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    cart.discountCode = null;
    cart.discountAmount = 0;
    await cart.save();
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/cart/:sessionId/country — update shipping country for preview
router.patch('/:sessionId/country', async (req, res) => {
  try {
    const { country } = req.body;
    if (!country || typeof country !== 'string' || country.length > 2) {
      return res.status(400).json({ error: 'Invalid country code' });
    }
    const cart = await Cart.findOne({ sessionId: req.params.sessionId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    cart.shippingCountry = country.toUpperCase();
    await cart.save();
    res.json({ ...cart.toObject(), ...summarise(cart) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
