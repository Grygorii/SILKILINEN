'use strict';
// Inclusion lists: future authentication/audit fields cannot silently leak into browser responses.
const ADMIN_CUSTOMER_FIELDS = '_id email firstName lastName phone defaultShippingAddress wishlist marketingConsent consent emailVerified lastLogin tags notes customerType internalRating firstOrderAt lastOrderAt orderCount totalSpend country city acquisitionSource acquisitionMedium acquisitionCampaign acquisitionCampaignId acquiredAt segments emailLog createdAt updatedAt profileSource gdprDeletedAt';
const CUSTOMER_ORDER_FIELDS = '_id orderNumber items subtotal discountCode discountAmount total displayCurrency exchangeRate chargedTotal shippingCost shippingMethod status statusHistory.status statusHistory.timestamp trackingNumber trackingUrl carrier shippedAt deliveredAt estimatedDelivery shippingAddress customerName customerNote refundedAmount refunds.amount refunds.createdAt createdAt updatedAt';
const WISHLIST_FIELDS = '_id name slug price compareAtPrice category status images image sizes colours colorName materialComposition momme isNewArrival isNew totalStock inStock';
function adminCustomerView(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return Object.fromEntries(ADMIN_CUSTOMER_FIELDS.split(' ').filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
}
module.exports = { ADMIN_CUSTOMER_FIELDS, CUSTOMER_ORDER_FIELDS, WISHLIST_FIELDS, adminCustomerView };
