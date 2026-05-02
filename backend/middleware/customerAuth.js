const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_CUSTOMER_SECRET || 'silkilinen_customer_secret_change_in_prod';

function requireCustomer(req, res, next) {
  const token = req.cookies.customer_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.customer = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

function optionalCustomer(req, res, next) {
  const token = req.cookies.customer_token;
  if (token) {
    try { req.customer = jwt.verify(token, SECRET); } catch { /* guest */ }
  }
  next();
}

module.exports = { requireCustomer, optionalCustomer };
