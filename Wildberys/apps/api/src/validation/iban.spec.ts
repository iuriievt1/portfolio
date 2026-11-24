import { describe, expect, it } from 'vitest';

import { isIban } from './iban.js';

describe('isIban', () => {
  it.each([
    ['a Czech account', 'CZ6508000000192000145399'],
    ['a Czech account without a prefix', 'CZ9320100000002000145399'],
    ['a Slovak account', 'SK3112000000198742637541'],
    ['a German account', 'DE89370400440532013000'],
    ['an account with letters', 'GB82WEST12345698765432'],
  ])('accepts %s', (_what, iban) => {
    expect(isIban(iban)).toBe(true);
  });

  it.each([
    ['one wrong digit', 'CZ6508000000192000145398'],
    ['two digits swapped', 'CZ6508000000192000145939'],
    // The check of the IBAN fits in both, the Czech check of the account does not.
    ['a Czech account number that fails its own check', 'CZ3408000000000000000001'],
    ['a Czech prefix that fails its own check', 'CZ1708000000012000145399'],
    ['a Czech account that is too short', 'CZ650800000019200014539'],
    ['spaces', 'CZ65 0800 0000 1920 0014 5399'],
    ['small letters', 'cz6508000000192000145399'],
    ['a text that is too short', 'CZ650800'],
    ['no country', '6508000000192000145399'],
    ['an empty text', ''],
    ['a number', 6508000000192000],
    ['nothing', undefined],
  ])('rejects %s', (_what, value) => {
    expect(isIban(value)).toBe(false);
  });
});
