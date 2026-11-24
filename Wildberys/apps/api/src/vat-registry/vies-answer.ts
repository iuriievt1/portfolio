import type { VatRecord } from './vat-registry.js';

/** What one answer of VIES means: the number is valid, it is not, or nobody could say. */
export type ViesAnswer =
  | { readonly status: 'valid'; readonly record: VatRecord }
  | { readonly status: 'invalid' }
  | { readonly status: 'unavailable' };

/** How VIES says a number is valid, and the two ways it says a number is not. */
const valid = 'VALID';
const invalid = ['INVALID', 'INVALID_INPUT'];

/** What VIES writes in place of a name or an address its country does not share. */
const notShared = '---';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A text of the register in one line: its lines are joined with commas,
 * and the runs of spaces some countries pad their lines with become single spaces.
 */
function oneLine(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const line = value
    .split('\n')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => part.length > 0)
    .join(', ');

  return line.length > 0 && line !== notShared ? line : null;
}

/**
 * Reads one answer of VIES (GET /ms/{country}/vat/{number}). The country is the one VIES was asked with,
 * so Greece comes as EL. Every answer that is neither a clear yes nor a clear no counts as no answer:
 * the register of a country is often closed for a while, and VIES then says so in the same field.
 */
export function readViesAnswer(viesCountry: string, answer: unknown): ViesAnswer {
  if (!isObject(answer)) {
    return { status: 'unavailable' };
  }

  if (typeof answer.userError === 'string' && invalid.includes(answer.userError)) {
    return { status: 'invalid' };
  }

  if (
    answer.userError !== valid ||
    answer.isValid !== true ||
    typeof answer.vatNumber !== 'string' ||
    answer.vatNumber.length === 0
  ) {
    return { status: 'unavailable' };
  }

  return {
    status: 'valid',
    record: {
      vatNumber: `${viesCountry}${answer.vatNumber}`,
      name: oneLine(answer.name),
      address: oneLine(answer.address),
    },
  };
}
