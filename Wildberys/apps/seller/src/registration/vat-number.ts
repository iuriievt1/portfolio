/** VAT numbers of Greece start with EL. Everywhere else they start with the letters of the country. */
const ownLetters: Readonly<Record<string, string>> = { GR: 'EL' };

/** The letters a VAT number of this country starts with: PL, EL. */
export function vatLetters(countryCode: string): string {
  return ownLetters[countryCode] ?? countryCode;
}

/**
 * What a person typed without the letters of the country in front of it. The field shows those
 * letters itself, so a number pasted whole, like "PL 5252674798", does not show them twice.
 */
export function withoutVatLetters(countryCode: string, typed: string): string {
  const letters = vatLetters(countryCode);
  const text = typed.trimStart();

  return text.toUpperCase().startsWith(letters) ? text.slice(letters.length).trimStart() : typed;
}

/**
 * A VAT number the way the API takes it: capital letters and digits in one piece, without the letters
 * of the country. People write "PL 525-267-47-98" as well as "5252674798".
 */
export function vatNumberOf(countryCode: string, typed: string): string {
  return withoutVatLetters(countryCode, typed)
    .replace(/[\s.-]+/g, '')
    .toUpperCase();
}

/** What the API takes for a VAT number without the letters of its country. */
const vatNumberPattern = /^[0-9A-Z+*]{2,12}$/;

export function isVatNumber(number: string): boolean {
  return vatNumberPattern.test(number);
}
