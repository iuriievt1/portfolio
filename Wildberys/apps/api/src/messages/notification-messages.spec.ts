import { describe, expect, it } from 'vitest';

import { signInApps } from '../auth/auth.dto.js';
import { Locale } from '../generated/prisma/enums.js';
import { fillMessage, getNotificationMessages } from './notification-messages.js';

const locales = Object.values(Locale);

describe('notification messages', () => {
  it.each(locales)('have a place for the code and its lifetime in every text (%s)', (locale) => {
    const { signInCodeEmail, phoneCodeSms } = getNotificationMessages(locale);

    expect(signInCodeEmail.subject).toContain('{code}');
    expect(signInCodeEmail.subject).toContain('{product}');
    expect(signInCodeEmail.text).toContain('{code}');
    expect(signInCodeEmail.text).toContain('{product}');
    expect(Object.keys(signInCodeEmail.products).sort()).toEqual([...signInApps].sort());
    expect(signInCodeEmail.text).toContain('{minutes}');
    expect(phoneCodeSms.text).toContain('{code}');
    expect(phoneCodeSms.text).toContain('{minutes}');
  });

  it('puts the values into a text, also when a value appears twice', () => {
    expect(
      fillMessage('{code} is valid for {minutes} minutes: {code}', { code: '482913', minutes: 10 }),
    ).toBe('482913 is valid for 10 minutes: 482913');
  });
});
