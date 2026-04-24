/**
 * Returns the correct Russian word form based on a number.
 * forms[0] = nominative singular (1 день)
 * forms[1] = genitive singular (2 дня)
 * forms[2] = genitive plural (5 дней)
 */
export function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) {
    return forms[2];
  }
  if (last > 1 && last < 5) {
    return forms[1];
  }
  if (last === 1) {
    return forms[0];
  }
  return forms[2];
}
