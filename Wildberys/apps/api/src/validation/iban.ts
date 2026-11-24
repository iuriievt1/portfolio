import { buildMessage, ValidateBy } from 'class-validator';

/** Two letters of the country, two check digits, then 11 to 30 letters and digits. No spaces. */
const ibanPattern = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** A = 10, B = 11 and so on: how the check of an IBAN reads a letter. */
const letterOffset = 55;

/** A Czech IBAN: the country, two check digits, the bank code, the prefix and the account number. */
const czechIbanPattern = /^CZ\d{2}\d{4}(\d{6})(\d{10})$/;
/** The weights the Czech National Bank gives to the digits of a prefix and of an account number. */
const czechPrefixWeights = [10, 5, 8, 4, 2, 1] as const;
const czechNumberWeights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1] as const;

function fitsCzechWeights(digits: string, weights: readonly number[]): boolean {
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);

  return sum % 11 === 0;
}

/**
 * A Czech account number has checks of its own, besides the one of the IBAN: the prefix and
 * the number each fit the weights of the Czech National Bank. They catch a wrong digit
 * in a number that a site turned into an IBAN, where the check of the IBAN always fits.
 */
function isCzechAccount(iban: string): boolean {
  const parts = czechIbanPattern.exec(iban);
  const [, prefix, accountNumber] = parts ?? [];

  return (
    prefix !== undefined &&
    accountNumber !== undefined &&
    fitsCzechWeights(prefix, czechPrefixWeights) &&
    fitsCzechWeights(accountNumber, czechNumberWeights)
  );
}

/**
 * An international bank account number (IBAN): capital letters and digits without spaces,
 * with check digits that fit the rest (ISO 13616, modulo 97). A Czech one also has to hold
 * an account number that fits the Czech rules.
 * It does not say the account exists. The payment provider checks that.
 */
export function isIban(value: unknown): boolean {
  if (typeof value !== 'string' || !ibanPattern.test(value)) {
    return false;
  }

  // The first four characters go to the end, letters become numbers, and the rest of the division is taken
  // one character at a time: the whole number is too long for a JavaScript number.
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;

  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const digits = character >= 'A' ? String(code - letterOffset) : character;

    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1 && (!value.startsWith('CZ') || isCzechAccount(value));
}

/** Checks a field with `isIban`. */
export function IsIban(): PropertyDecorator {
  return ValidateBy({
    name: 'isIban',
    validator: {
      validate: isIban,
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be an IBAN without spaces`,
      ),
    },
  });
}
