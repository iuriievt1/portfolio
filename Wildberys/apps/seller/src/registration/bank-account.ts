/** A Czech account the way people write it: an optional prefix, a dash and the number. */
const accountNumberPattern = /^(?:(\d{1,6})-)?(\d{2,10})$/;
const bankCodePattern = /^\d{4}$/;

/** "CZ" as the check of an IBAN reads it (C = 12, Z = 35), with two zeros where the check digits go. */
const czechCountryAsDigits = '123500';

function remainderOf97(digits: string): number {
  let remainder = 0;

  // One digit at a time: the whole number is too long for a JavaScript number.
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder;
}

/**
 * The IBAN of a Czech account written as a number and a bank code: "19-2000145399" and "0800"
 * give CZ6508000000192000145399. Undefined when one of them is not written that way.
 * Whether the number itself is right is checked by the API.
 */
export function czechIban(accountNumber: string, bankCode: string): string | undefined {
  const parts = accountNumberPattern.exec(accountNumber.replace(/\s+/g, ''));
  const [, prefix = '', base] = parts ?? [];
  const bank = bankCode.trim();

  if (base === undefined || !bankCodePattern.test(bank)) {
    return undefined;
  }

  const account = `${bank}${prefix.padStart(6, '0')}${base.padStart(10, '0')}`;
  const check = 98 - remainderOf97(`${account}${czechCountryAsDigits}`);

  return `CZ${String(check).padStart(2, '0')}${account}`;
}

/** A Czech IBAN: the country, two check digits, the bank code, the prefix and the account number. */
const czechIbanPattern = /^CZ\d{2}(\d{4})(\d{6})(\d{10})$/;

/** An IBAN the way it is stored and sent: capital letters and digits without spaces. */
export function compactIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** An IBAN the way it is printed: in groups of four. */
export function groupedIban(iban: string): string {
  return compactIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * The account number and the bank code inside a Czech IBAN: CZ6508000000192000145399
 * gives "19-2000145399" and "0800". Undefined for an IBAN of another country.
 */
export function czechAccountOf(
  iban: string,
): { readonly accountNumber: string; readonly bankCode: string } | undefined {
  const [, bankCode, prefix, base] = czechIbanPattern.exec(compactIban(iban)) ?? [];

  if (bankCode === undefined || prefix === undefined || base === undefined) {
    return undefined;
  }

  const shortPrefix = prefix.replace(/^0+/, '');
  const shortBase = base.replace(/^0+/, '');

  return { accountNumber: shortPrefix ? `${shortPrefix}-${shortBase}` : shortBase, bankCode };
}
