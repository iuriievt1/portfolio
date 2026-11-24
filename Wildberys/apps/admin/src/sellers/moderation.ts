import {
  sellerModerationCounts,
  sellerModerationFind,
  sellerModerationList,
  sellerModerationRegisterCheck,
  type ModeratedSeller,
  type ModeratedSellersPage,
  type SellerCounts,
  type SellerRegisterCheck,
  type SellerStatus,
} from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { authConfig } from '../auth/config';

// A reader answers undefined when the API did not answer with what was asked for:
// nobody is signed in, the person may not see sellers, or the API cannot be reached.

/** How many sellers are in each status, for the tabs of the list. */
export async function getSellerCounts(): Promise<SellerCounts | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data } = await sellerModerationCounts({ client });

  return data;
}

/** One page of the sellers in a status, in the order the API keeps for the status. */
export async function getSellersPage(
  status: SellerStatus,
  cursor?: string,
): Promise<ModeratedSellersPage | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data } = await sellerModerationList({ client, query: { status, cursor } });

  return data;
}

/** Everything the team decides about a seller by. An id no seller has opens the "not found" page. */
export async function getSeller(sellerId: string): Promise<ModeratedSeller | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data, response } = await sellerModerationFind({ client, path: { sellerId } });

  if (response?.status === 404) {
    notFound();
  }

  return data;
}

/**
 * What the public registers say about the company of a seller now. The registers are asked
 * once per request, however many parts of the card show the answer.
 */
export const getRegisterCheck = cache(
  async (sellerId: string): Promise<SellerRegisterCheck | undefined> => {
    const client = await userApiClient(authConfig());

    if (!client) {
      return undefined;
    }

    const { data } = await sellerModerationRegisterCheck({ client, path: { sellerId } });

    return data;
  },
);
