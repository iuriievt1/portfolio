import { getCurrentUser } from '@bluberi/web-auth/session';
import { connection } from 'next/server';
import { cache } from 'react';

import { authConfig } from './config';

/** The signed-in user. Asked from the API once per request, however many components need it. */
export const getUser = cache(async () => {
  // Wait for a real request first. Without this the build would try to read the user and the settings.
  await connection();

  return getCurrentUser(authConfig());
});
