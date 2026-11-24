import cs from '@bluberi/i18n/messages/notifications/cs.json' with { type: 'json' };
import en from '@bluberi/i18n/messages/notifications/en.json' with { type: 'json' };

import type { Locale } from '../generated/prisma/enums.js';

type NotificationMessages = typeof cs;

/** Texts of the emails and SMS the API sends. Every language must have the same keys. */
const notificationMessages: Record<Locale, NotificationMessages> = { cs, en };

export function getNotificationMessages(locale: Locale): NotificationMessages {
  return notificationMessages[locale];
}

/** Puts values into a text: "Code {code}" with { code: '123456' } becomes "Code 123456". */
export function fillMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
