import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { connection, type NextRequest } from 'next/server';

import { routing } from '../../../i18n/routing';
import { sellerPortalUrl } from '../../../settings';

/** The registration of a seller in the seller portal, without the language in front. */
const registrationPath = '/registrace';

/**
 * Every "sell on Bluberi" button of the store leads here, and from here to the registration
 * in the seller portal, in the language of the page the person left. The pages of the store
 * are built before the address of the portal is known, so their links cannot name it.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<'/[locale]/prodejci'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // The address of the portal is a setting: it is read when a request comes, not when the app is built.
  await connection();

  const languagePath = locale === routing.defaultLocale ? '' : `/${locale}`;

  return Response.redirect(`${sellerPortalUrl()}${languagePath}${registrationPath}`, 307);
}
