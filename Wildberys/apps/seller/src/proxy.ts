import { sellerRegistrationState } from '@bluberi/api-client';
import { requestApiClient, resolveSession } from '@bluberi/web-auth/proxy';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import {
  authConfig,
  homePath,
  liveEventsPath,
  registrationPath,
  reviewOutcomePath,
  signInPath,
  signOutPath,
} from './auth/config';
import { localizedPath, splitLanguage } from './i18n/paths';
import { routing } from './i18n/routing';
import { isOpen, nextPage, pageOfPath, pagePaths } from './registration/steps';

const handleLanguage = createMiddleware(routing);

/** The statuses in which the owner of a seller has neither the portal nor the registration. */
const closedStatuses = ['REJECTED', 'SUSPENDED'];

/**
 * The page a signed-in person belongs on. The portal opens to people who work for a seller
 * that is being checked or was approved. The owner of a seller the team refused or stopped
 * sees only what the team decided. Everybody else is in the registration, at a page they have reached.
 */
async function rightPlace(request: NextRequest, path: string): Promise<string> {
  // A form sends its data to the page it is on. Only opening a page is checked.
  if (request.method !== 'GET') {
    return path;
  }

  const client = requestApiClient(request, authConfig());
  const registration = client
    ? await sellerRegistrationState({ client }).then(
        ({ data }) => data,
        () => undefined,
      )
    : undefined;

  // The API did not answer. The page says so itself.
  if (!registration) {
    return path;
  }

  const page = pageOfPath(path);

  if (registration.portalOpen) {
    return page || path === signInPath || path === reviewOutcomePath || path === '/'
      ? homePath
      : path;
  }

  if (registration.seller && closedStatuses.includes(registration.seller.status)) {
    return reviewOutcomePath;
  }

  return page && isOpen(page, registration) ? path : pagePaths[nextPage(registration)];
}

/**
 * Runs before every page: keeps the session alive, sends people to the page they belong on
 * (the sign-in, the registration or the portal) and puts the language into the URL.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await resolveSession(request, authConfig());
  const { locale, path } = splitLanguage(request.nextUrl.pathname);
  const redirectTo = (target: string): NextResponse =>
    NextResponse.redirect(new URL(localizedPath(target, locale), request.url));

  if (path === signOutPath) {
    return session.applyTo(handleLanguage(request));
  }

  if (!session.signedIn) {
    // The first step of the registration is where an account is made, so it is open to everyone.
    if (path === signInPath || path === registrationPath) {
      return session.applyTo(handleLanguage(request));
    }

    return session.applyTo(
      redirectTo(path.startsWith(`${registrationPath}/`) ? registrationPath : signInPath),
    );
  }

  // The stream of live events is not a page: a person is not sent anywhere from it.
  if (path === liveEventsPath) {
    return session.applyTo(handleLanguage(request));
  }

  const place = await rightPlace(request, path);

  return session.applyTo(place === path ? handleLanguage(request) : redirectTo(place));
}

export const config = {
  matcher: '/((?!_next|.*\\..*).*)',
};
