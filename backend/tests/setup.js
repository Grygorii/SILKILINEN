'use strict';

// Vitest doesn't need the real env vars for unit tests, but several modules
// crash on require() if certain keys are missing. Set safe placeholders here.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-32chars';
process.env.JWT_CUSTOMER_SECRET = process.env.JWT_CUSTOMER_SECRET || 'test-customer-secret-test-customer-32chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
