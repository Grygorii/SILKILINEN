'use strict';
const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded', 'partially_refunded', 'failed'];

// Which statuses may follow which. The enum stopped an INVALID status; nothing
// stopped an impossible JOURNEY, so "cancelled" -> "shipped" and "refunded" ->
// "paid" were both accepted — and each of those fires a customer email. One
// mis-click told someone their cancelled order was on its way.
//
// Terminal states (delivered, refunded) have no forward moves. `returned` can
// still be refunded, because that is the real sequence.
const STATUS_TRANSITIONS = {
  pending:    ['paid', 'failed', 'cancelled'],
  paid:       ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped:    ['delivered', 'returned', 'refunded'],
  delivered:  ['returned', 'refunded'],
  returned:   ['refunded'],
  cancelled:  [],
  refunded:   [],
  failed:     ['pending', 'cancelled'],
  partially_refunded: ['processing', 'shipped', 'delivered', 'returned', 'refunded'],
};

module.exports = { VALID_STATUSES, STATUS_TRANSITIONS };
