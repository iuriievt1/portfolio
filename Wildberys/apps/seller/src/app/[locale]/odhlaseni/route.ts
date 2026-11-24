import { signOut, signOutFromForm } from '@bluberi/web-auth/session';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { authConfig, signInPath } from '../../../auth/config';
import { localizedPath } from '../../../i18n/paths';

/**
 * Removes the session cookies and goes to the sign-in page. Pages send people here
 * when the cookies are still in the browser but the session has ended in the API.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<'/[locale]/odhlaseni'>) {
  const { locale } = await params;

  await signOut(authConfig());
  redirect(localizedPath(signInPath, locale));
}

/** The sign-out button posts here. */
export async function POST(request: NextRequest, { params }: RouteContext<'/[locale]/odhlaseni'>) {
  const { locale } = await params;

  return signOutFromForm(authConfig(), request, localizedPath(signInPath, locale));
}
