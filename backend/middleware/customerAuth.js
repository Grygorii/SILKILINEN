const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_CUSTOMER_SECRET;
if (!SECRET) {
  console.error('FATAL: JWT_CUSTOMER_SECRET is not set. Server cannot start without customer auth secret.');
  process.exit(1);
}

function requireCustomer(req, res, next) {
  const token = req.cookies.customer_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.customer = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

function optionalCustomer(req, res, next) {
  const token = req.cookies.customer_token;
  if (token) {
    try { req.customer = jwt.verify(token, SECRET, { algorithms: ['HS256'] }); } catch { /* guest */ }
  }
  next();
}

module.exports = { requireCustomer, optionalCustomer };
