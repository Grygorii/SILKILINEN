// Format a EUR amount in the currency an order was actually charged in. Orders
// store EUR (canonical) plus the displayCurrency + exchangeRate at purchase, so
// past orders always render in what the customer paid — independent of the
// currency currently selected in the header.

const SYMBOL: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' };

export function orderMoney(
  order: { displayCurrency?: string; exchangeRate?: number } | null | undefined,
  eur: number,
): string {
  const cur = String(order?.displayCurrency || 'EUR').toUpperCase();
  const sym = SYMBOL[cur] || '€';
  const rate = Number(order?.exchangeRate) || 1;
  return `${sym}${((Number(eur) || 0) * rate).toFixed(2)}`;
}
