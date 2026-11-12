'use strict';
const { normalizeEmail } = require('./customerIdentity');
function bad(message) { const err = new Error(message); err.status = 400; err.expose = true; throw err; }
function validateProfile(body = {}, admin = false) {
  const update = {};
  for (const key of ['firstName', 'lastName', 'phone']) if (key in body) {
    if (typeof body[key] !== 'string' || body[key].length > 160) bad(`Invalid ${key}`);
    update[key] = body[key].trim();
  }
  if ('marketingConsent' in body) {
    if (typeof body.marketingConsent !== 'boolean') bad('Marketing consent must be a boolean');
    update.marketingConsent = body.marketingConsent;
  }
  if ('defaultShippingAddress' in body && !admin) {
    const address = body.defaultShippingAddress;
    if (address !== null && (typeof address !== 'object' || Array.isArray(address))) bad('Invalid address');
    if (address === null) update.defaultShippingAddress = null;
    else {
      update.defaultShippingAddress = {};
      for (const key of ['line1','line2','city','county','postcode','country']) if (key in address) {
        if (typeof address[key] !== 'string' || address[key].length > 200) bad('Invalid address field');
        update.defaultShippingAddress[key] = address[key].trim();
      }
    }
  }
  if (admin) {
    if ('tags' in body) {
      if (!Array.isArray(body.tags) || body.tags.length > 30 || body.tags.some(t => typeof t !== 'string' || t.length > 60)) bad('Invalid tags');
      update.tags = [...new Set(body.tags.map(t => t.trim()).filter(Boolean))];
    }
    if ('customerType' in body) {
      if (!['retail','wholesale','vip','internal'].includes(body.customerType)) bad('Invalid customer type');
      update.customerType = body.customerType;
    }
    if ('internalRating' in body) {
      if (body.internalRating !== null && (!Number.isInteger(body.internalRating) || body.internalRating < 1 || body.internalRating > 5)) bad('Rating must be from 1 to 5');
      update.internalRating = body.internalRating;
    }
    if ('consent' in body) {
      if (![null,'accepted','rejected'].includes(body.consent)) bad('Invalid consent');
      update.consent = body.consent;
    }
  }
  return update;
}
function requireEmail(value) { const email = normalizeEmail(value); if (!email) bad('Valid email required'); return email; }
module.exports = { validateProfile, requireEmail, bad };
