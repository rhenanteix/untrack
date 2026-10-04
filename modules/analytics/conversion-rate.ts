/** Conversion rate is conversions divided by unique visitors in the same scope. */
export function conversionRate(conversions: number, uniqueVisitors: number) {
  return uniqueVisitors
    ? Number(((conversions / uniqueVisitors) * 100).toFixed(1))
    : 0;
}