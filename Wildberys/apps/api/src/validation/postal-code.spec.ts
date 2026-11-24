import { describe, expect, it } from 'vitest';

import { isPostalCodeOf } from './postal-code.js';

describe('isPostalCodeOf', () => {
  it.each(['10100', '27601'])('takes the Czech code %s', (postalCode) => {
    expect(isPostalCodeOf('CZ', postalCode)).toBe(true);
  });

  it.each(['101 00', '1010', '101000', '61-569', ''])(
    'refuses %s for a Czech address',
    (postalCode) => {
      expect(isPostalCodeOf('CZ', postalCode)).toBe(false);
    },
  );

  it.each([
    ['PL', '61-569'],
    ['NL', '1012 AB'],
    ['IE', 'D02 X285'],
    ['LV', 'LV-1010'],
    ['SK', '811 01'],
    ['AT', '1010'],
  ])('takes a code of %s: %s', (countryCode, postalCode) => {
    expect(isPostalCodeOf(countryCode, postalCode)).toBe(true);
  });

  it.each(['', '1', '-1010', '1010-', '61_569', 'd02 x285', '1234567890123'])(
    'refuses %s for an address abroad',
    (postalCode) => {
      expect(isPostalCodeOf('PL', postalCode)).toBe(false);
    },
  );
});
