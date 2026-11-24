import { sellerRegistrationState, type SellerRegistration } from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { connection } from 'next/server';
import { cache } from 'react';

import { authConfig } from '../auth/config';

/**
 * Where the registration of the signed-in person stands. Undefined when nobody is signed in.
 * Asked from the API once per request, however many components need it.
 */
export const getRegistration = cache(async (): Promise<SellerRegistration | undefined> => {
  // Wait for a real request first. Without this the build would try to read the session and the settings.
  await connection();

  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data } = await sellerRegistrationState({ client });

  return data;
});
