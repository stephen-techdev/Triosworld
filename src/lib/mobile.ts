/**
 * Mobile-number normalisation, shared by the sign-in and registration forms.
 *
 * Customers type and paste numbers in whatever shape their contacts app holds:
 * +91 prefixed, a leading trunk zero, spaces, dashes, brackets. Stripping
 * characters as they type (the previous behaviour) silently produced the wrong
 * ten digits — "+919876543210" became 9198765432, which still passed the
 * 6-9 range check but belonged to nobody — and capping the input at ten
 * characters rejected "+919876543210" outright on the sign-in page.
 *
 * So the field is left free-form and the value is normalised once, on submit.
 */
export function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Drop trunk-zero prefixes (0987…) and any +91 / 91 country code, then keep
  // the final ten digits.
  return digits.replace(/^0+/, '').slice(-10);
}

export function digitsIn(raw: string): number {
  return raw.replace(/\D/g, '').length;
}

/** True for a genuine 10-digit Indian mobile number. */
export function isValidIndianMobile(normalised: string): boolean {
  return /^[6-9]\d{9}$/.test(normalised);
}

/** The message shown under the field, or null when it looks fine. */
export function mobileError(raw: string): string | null {
  const count = digitsIn(raw);
  if (count === 0) return 'Enter your mobile number';
  if (count < 10) return `Enter a 10-digit mobile number — you've entered ${count}`;
  if (!isValidIndianMobile(normaliseMobile(raw))) {
    return 'That does not look like an Indian mobile number';
  }
  return null;
}