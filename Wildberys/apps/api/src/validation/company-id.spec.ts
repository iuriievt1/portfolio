import { describe, expect, it } from 'vitest';

import { isCompanyId } from './company-id.js';

describe('a Czech company number (IČO)', () => {
  it.each(['27082440', '00006947', '25596641'])('is right with its check digit: %s', (value) => {
    expect(isCompanyId(value)).toBe(true);
  });

  it.each([
    ['a wrong check digit', '27082441'],
    ['seven digits', '2708244'],
    ['nine digits', '270824400'],
    ['spaces between the digits', '270 82 440'],
    ['letters', 'CZ270824'],
    ['nothing', ''],
  ])('is wrong with %s', (_what, value) => {
    expect(isCompanyId(value)).toBe(false);
  });

  it('is wrong when it is not a text', () => {
    expect(isCompanyId(27082440)).toBe(false);
    expect(isCompanyId(undefined)).toBe(false);
  });
});
