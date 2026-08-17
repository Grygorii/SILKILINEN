'use strict';

// Vitest doesn't need the real env vars for unit tests, but several modules
// crash on require() if certain keys are missing. Set safe placeholders here.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-32chars';
process.env.JWT_CUSTOMER_SECRET = process.env.JWT_CUSTOMER_SECRET || 'test-customer-secret-test-customer-32chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// checkoutV2 constructs the Stripe client at require() time, which throws with no
// key — so importing it for a unit test (tests/orderTotals.test.js reads
// bestCollectionDiscount from it) fails before any test runs. A placeholder is
// enough: nothing in the pure tests makes a Stripe call.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_unit_tests';
