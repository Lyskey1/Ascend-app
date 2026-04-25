// Shared helper for decimal text inputs that must accept both "." and ","
// as decimal separators (mobile browsers in many locales surface "," on the
// numeric keypad). Use with: type="text" inputMode="decimal" pattern={DECIMAL_INPUT_PATTERN}

export const DECIMAL_INPUT_PATTERN = '[0-9]*[.,]?[0-9]*';

export function parseDecimalInput(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

// Strips characters that aren't digits or a decimal separator, collapses
// multiple separators into one. Handy when you want to live-sanitize input.
export function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.,]/g, '');
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;
  const before = cleaned.slice(0, firstSep + 1);
  const after = cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
  return before + after;
}
