import { signOut, signOutFromForm } from '@bluberi/web-auth/session';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { authConfig, signInPath } from '../../auth/config';

/**
 * Removes the session cookies and goes to the sign-in page. Pages send people here
 * when the cookies are still in the browser but the session has ended in the API.
 */
export async function GET() {
  // Runs for a real request only, never when the app is built.
  await connection();
  await signOut(authConfig());
  redirect(signInPath);
}

/** The sign-out button posts here. */
export async function POST(request: Request) {
  return signOutFromForm(authConfig(), request, signInPath);
}
