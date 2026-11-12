const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const SECRET = process.env.JWT_CUSTOMER_SECRET;
if (!SECRET) {
  console.error('FATAL: JWT_CUSTOMER_SECRET is not set.');
  process.exit(1);
}
async function identity(req) {
  const token = req.cookies?.customer_token;
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] }); } catch { return null; }
  if (!/^[0-9a-fA-F]{24}$/.test(payload.customerId || '')) return null;
  // An old cookie cannot re-open an erased account. A guest CRM row is not an authenticated account.
  const active = await Customer.exists({ _id: payload.customerId, gdprDeletedAt: null, emailVerified: true });
  return active ? payload : null;
}
async function requireCustomer(req, res, next) {
  try {
    req.customer = await identity(req);
    if (!req.customer) return res.status(401).json({ error: 'Not authenticated' });
    res.set('Cache-Control', 'no-store');
    next();
  } catch { res.status(503).json({ error: 'Account service temporarily unavailable' }); }
}
async function optionalCustomer(req, res, next) {
  try { req.customer = await identity(req); } catch { req.customer = null; }
  next();
}
module.exports = { requireCustomer, optionalCustomer };
