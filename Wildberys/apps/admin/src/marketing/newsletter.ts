import { newsletterAdminList, type NewsletterPage } from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';

import { authConfig } from '../auth/config';

/**
 * One page of the people who get the news by email, newest first. Undefined when the API did not
 * answer with a list: nobody is signed in, the person may not see it, or the cursor in the address
 * is not one of ours.
 */
export async function getNewsletterPage(cursor?: string): Promise<NewsletterPage | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data } = await newsletterAdminList({ client, query: { cursor } });

  return data;
}
