/** A Czech postal code: five digits without a space. */
const czechPostalCode = /^\d{5}$/;

/**
 * A postal code of any country: capital letters, digits, spaces and dashes,
 * like "61-569", "1012 AB" and "D02 X285". Every country writes its codes its own way.
 */
export const postalCodePattern = /^[0-9A-Z][0-9A-Z -]{1,9}[0-9A-Z]$/;

/** Whether an address in this country can have this postal code. Only Czech codes are checked closely. */
export function isPostalCodeOf(countryCode: string, postalCode: string): boolean {
  return (countryCode === 'CZ' ? czechPostalCode : postalCodePattern).test(postalCode);
}
