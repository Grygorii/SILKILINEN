const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Product = require('../models/Product');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 499, currency: 'eur' },
      display_name: 'Standard Shipping — Ireland',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 3 },
        maximum: { unit: 'business_day', value: 5 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 999, currency: 'eur' },
      display_name: 'Standard Shipping — EU',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 5 },
        maximum: { unit: 'business_day', value: 10 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1499, currency: 'eur' },
      display_name: 'Standard Shipping — UK / US / CA / AU',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 7 },
        maximum: { unit: 'business_day', value: 14 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1999, currency: 'eur' },
      display_name: 'Standard Shipping — Worldwide',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 10 },
        maximum: { unit: 'business_day', value: 21 },
      },
    },
  },
];

const ALLOWED_COUNTRIES = [
  'IE','GB','US','CA','AU','NZ','DE','FR','IT','ES','NL','BE','AT',
  'PL','SE','DK','NO','FI','PT','CH','GR','HU','CZ','SK','RO','BG',
  'HR','CY','EE','LV','LT','LU','MT','SI',
];

router.post('/', async function(req, res) {
  try {
    const { items, attribution } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many items in cart' });
    }

    // Validate quantities and fetch authoritative prices from DB
    const validatedItems = [];
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return res.status(400).json({ error: 'Invalid item quantity' });
      }

      // Look up product from DB — by productId if provided, fallback to name
      let product = null;
      if (item.productId) {
        product = await Product.findOne({ _id: item.productId, status: { $in: ['active', 'sold_out'] } }).lean();
      } else if (item.name) {
        product = await Product.findOne({ name: item.name, status: { $in: ['active', 'sold_out'] } }).lean();
      }

      if (!product) {
        return res.status(400).json({ error: `Product "${item.name || item.productId}" is no longer available` });
      }

      // Use DB price — never trust browser
      validatedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,      // authoritative price from DB
        colour: item.colour || '',
        size: item.size || '',
        quantity: item.quantity,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: validatedItems.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            description: [item.colour, item.size].filter(Boolean).join(' / ') || undefined,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      shipping_options: SHIPPING_OPTIONS,
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
      metadata: {
        utm_source:   attribution?.source   ?? 'direct',
        utm_medium:   attribution?.medium   ?? 'none',
        utm_campaign: attribution?.campaign ?? 'none',
        referrer:     attribution?.referrer ?? '',
        landing_page: attribution?.landingPage ?? '',
      },
    });

    await Order.create({
      stripeSessionId:  session.id,
      items: validatedItems.map(({ name, price, colour, size, quantity }) => ({ name, price, colour, size, quantity })),
      total: validatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      status: 'pending',
      attribution: {
        source:      attribution?.source   ?? 'direct',
        medium:      attribution?.medium   ?? 'none',
        campaign:    attribution?.campaign ?? 'none',
        referrer:    attribution?.referrer ?? '',
        landingPage: attribution?.landingPage ?? '',
      },
      browserSessionId: req.body.sessionId || undefined,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
