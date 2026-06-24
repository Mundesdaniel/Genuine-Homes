// East African currencies are zero-decimal; format without cents.
const ZERO_DECIMAL = new Set(['UGX', 'KES', 'TZS']);

export function formatMoney(amount: number, currency = 'UGX'): string {
  const fractionDigits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatDistance(metres: number | null): string | null {
  if (metres == null) return null;
  return metres < 1000
    ? `${Math.round(metres)} m away`
    : `${(metres / 1000).toFixed(1)} km away`;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}
