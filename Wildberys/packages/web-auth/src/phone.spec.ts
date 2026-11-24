import { describe, expect, it } from 'vitest';

import { formatPhone, phoneStart, withoutSeparators } from './phone';

describe('a phone number a person typed', () => {
  it('loses its spaces, dashes and brackets', () => {
    expect(withoutSeparators('+420 777 123 456')).toBe('+420777123456');
    expect(withoutSeparators(' +420 (777) 123-456 ')).toBe('+420777123456');
  });

  it('is left alone when it has none', () => {
    expect(withoutSeparators('+420777123456')).toBe('+420777123456');
  });

  it('is shown in groups when it is Czech or Slovak, and as it is otherwise', () => {
    expect(formatPhone('+420777123456')).toBe('+420 777 123 456');
    expect(formatPhone('+421901234567')).toBe('+421 901 234 567');
    expect(formatPhone('+4915112345678')).toBe('+4915112345678');
  });

  it('starts with the calling code of Czechia, which the API takes once the number follows', () => {
    expect(withoutSeparators(`${phoneStart}777 123 456`)).toBe('+420777123456');
  });
});
