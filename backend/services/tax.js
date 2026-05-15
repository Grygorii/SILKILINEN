// SILKILINEN is a sole trader below the Irish VAT registration threshold.
// No VAT is charged. This stub exists so the checkout engine has a consistent
// interface if VAT is introduced later.

function calculateTax(/* subtotal, countryCode */) {
  return {
    shouldDisplay: false,
    amount: 0,
    rate: 0,
    label: '',
  };
}

module.exports = { calculateTax };
