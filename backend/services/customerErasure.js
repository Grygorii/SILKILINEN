'use strict';
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { ordersForCustomer, erasedEmailHash } = require('../utils/customerIdentity');
async function eraseCustomer(customerId) {
  let result;
  await mongoose.connection.transaction(async session => {
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) { const e = new Error('Not found'); e.status = 404; throw e; }
    if (customer.gdprDeletedAt) { const e = new Error('Already anonymised'); e.status = 409; throw e; }
    const email = customer.email;
    const anonEmail = `deleted-${customer._id}@anonymised.silkilinen.com`;
    // Retained orders must not be used by the repair worker to resurrect this contact.
    await Order.updateMany({ ...ordersForCustomer(customer), customerId: null }, {
      $set: { customerId: customer._id, customerSyncPending: false, customerSyncVersion: 1, customerSyncStatus: 'erased' },
    }, { session, timestamps: false });
    await Customer.updateOne({ _id: customer._id }, { $set: {
      email: anonEmail, erasedEmailHash: erasedEmailHash(email), firstName: '[Deleted]', lastName: '', phone: '',
      defaultShippingAddress: null, passwordHash: null, googleId: null, wishlist: [], tags: [], notes: [], emailLog: [], lastWishlistReminderAttemptedAt: null,
      marketingConsent: false, consent: 'rejected', emailVerified: false, emailVerificationToken: null,
      emailVerificationExpiry: null, passwordResetToken: null, passwordResetExpiry: null, lastLogin: null,
      country: '', city: '', acquisitionSource: '', acquisitionMedium: '', acquisitionCampaign: '',
      acquisitionCampaignId: null, acquisitionVisitId: null, acquiredAt: null, segments: [], gdprDeletedAt: new Date(),
    } }, { session });
    const carts = await require('../models/Cart').updateMany({ email }, { $set: { email: null, recoveryUnsubscribed: true } }, { session });
    const subs = await require('../models/Newsletter').deleteMany({ email }, { session });
    const waitlist = await require('../models/StockNotification').deleteMany({ email }, { session });
    const wishlistInterests = await require('../models/WishlistInterest').deleteMany({ customerId: customer._id }, { session });
    result = { success: true, anonEmail, purged: { carts: carts.modifiedCount, newsletter: subs.deletedCount,
      stockWaitlist: waitlist.deletedCount, wishlistInterests: wishlistInterests.deletedCount,
      ordersRetained: 'financial records retained; excluded from profile reconstruction' } };
  });
  return result;
}
module.exports = { eraseCustomer };
