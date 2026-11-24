import { resolveSession } from '@bluberi/web-auth/proxy';
import { NextResponse, type NextRequest } from 'next/server';

import { authConfig, homePath, signInPath, signOutPath } from './auth/config';

/** Runs before every page: keeps the session alive and sends people who are not signed in to the sign-in page. */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await resolveSession(request, authConfig());
  const path = request.nextUrl.pathname;
  const redirectTo = (target: string): NextResponse =>
    NextResponse.redirect(new URL(target, request.url));
  // The request goes on with the cookies the session check may have renewed.
  const goOn = (): NextResponse => NextResponse.next({ request: { headers: request.headers } });

  if (path === signOutPath) {
    return session.applyTo(goOn());
  }

  if (!session.signedIn && path !== signInPath) {
    return session.applyTo(redirectTo(signInPath));
  }

  if (session.signedIn && (path === signInPath || path === '/')) {
    return session.applyTo(redirectTo(homePath));
  }

  return session.applyTo(goOn());
}

export const config = {
  matcher: '/((?!_next|.*\\..*).*)',
};
