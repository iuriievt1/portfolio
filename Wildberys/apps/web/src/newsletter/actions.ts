'use server';

import { newsletterSubscribe, newsletterUnsubscribe } from '@bluberi/api-client';
import {
  done,
  failure,
  invalidInput,
  succeeded,
  type ActionResult,
} from '@bluberi/web-auth/action-result';
import { createApiClient } from '@bluberi/web-auth/api-client';
import { hasLocale } from 'next-intl';

import { routing } from '../i18n/routing';
import { apiConfig } from '../settings';

/**
 * Signs an email up for the news. The language is fixed by the page that renders the form.
 * The rest comes from the browser and is checked.
 */
export async function subscribe(
  locale: string,
  email: unknown,
  consent: unknown,
): Promise<ActionResult> {
  if (!hasLocale(routing.locales, locale) || typeof email !== 'string' || consent !== true) {
    return invalidInput;
  }

  const result = await newsletterSubscribe({
    client: createApiClient(apiConfig()),
    body: { email, locale, consent },
  });

  return succeeded(result) ? done : failure(result.error);
}

/** Stops the news for an email. The answer is the same whether it was on the list or not. */
export async function unsubscribe(email: unknown): Promise<ActionResult> {
  if (typeof email !== 'string') {
    return invalidInput;
  }

  const result = await newsletterUnsubscribe({
    client: createApiClient(apiConfig()),
    body: { email },
  });

  return succeeded(result) ? done : failure(result.error);
}
